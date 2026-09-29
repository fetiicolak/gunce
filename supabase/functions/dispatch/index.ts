// pg_cron tarafından dakikada bir çağrılır. Zamanı gelen hatırlatmaları bulur,
// tekrarlayan hatırlatmaları ileri sarar ve Web Push bildirimlerini gönderir.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  effectiveTime,
  fireTimes,
  nextOccurrence,
  zonedParts,
  zonedToUtc,
  type FireTime,
  type ScheduleSettings,
  type SchedulableItem,
} from '../_shared/schedule.ts'

const WINDOW_MS = 6 * 60_000
const DEFAULT_SETTINGS: ScheduleSettings = { timezone: 'Europe/Istanbul', default_time: '09:00' }

interface Item extends SchedulableItem {
  user_id: string
  title: string
  note: string
}
interface Sub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}
interface Payload {
  title: string
  body: string
  url: string
  tag: string
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:gunce@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return await testNotification(req)
  }
  try {
    const result = await run(Date.now())
    return Response.json(result)
  } catch (e) {
    console.error(e)
    return Response.json({ error: String(e) }, { status: 500 })
  }
})

async function run(now: number) {
  const [{ data: items, error: e1 }, { data: settingsRows, error: e2 }, { data: subs, error: e3 }] = await Promise.all([
    supabase
      .from('items')
      .select('id,user_id,kind,title,note,due_date,due_time,time_explicit,recurrence,reminders,completed_at,deleted_at')
      .is('deleted_at', null)
      .is('completed_at', null),
    supabase.from('settings').select('user_id,timezone,default_time'),
    supabase.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth'),
  ])
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3

  const settingsByUser = new Map<string, ScheduleSettings>()
  for (const s of settingsRows ?? []) settingsByUser.set(s.user_id, s)

  let rolled = 0
  const due: { item: Item; ft: FireTime; settings: ScheduleSettings }[] = []

  for (const item of (items ?? []) as Item[]) {
    const settings = settingsByUser.get(item.user_id) ?? DEFAULT_SETTINGS
    if (await rollForward(item, settings, now)) rolled++
    for (const ft of fireTimes(item, settings)) {
      if (ft.at <= now && ft.at > now - WINDOW_MS) due.push({ item, ft, settings })
    }
  }
  if (!due.length) return { rolled, sent: 0 }

  // Bildirimleri göndermeden önce günlüğe yazarak sahiplen; zaten varsa atla (tekrar gönderimi önler)
  const { data: claimed, error } = await supabase
    .from('notification_log')
    .upsert(
      due.map((d) => ({ item_id: d.item.id, fire_key: d.ft.key })),
      { onConflict: 'item_id,fire_key', ignoreDuplicates: true },
    )
    .select('item_id,fire_key')
  if (error) throw error
  const claimedKeys = new Set((claimed ?? []).map((c) => `${c.item_id}#${c.fire_key}`))
  const toSend = due.filter((d) => claimedKeys.has(`${d.item.id}#${d.ft.key}`))

  const byUser = new Map<string, typeof toSend>()
  for (const d of toSend) {
    const list = byUser.get(d.item.user_id) ?? []
    list.push(d)
    byUser.set(d.item.user_id, list)
  }

  let sent = 0
  for (const [userId, entries] of byUser) {
    const settings = entries[0].settings
    const digest = entries.filter((d) => isDigestable(d.item, d.ft))
    const single = digest.length >= 2 ? entries.filter((d) => !digest.includes(d)) : entries
    const payloads = single.map((d) => singlePayload(d.item, d.ft, settings))
    if (digest.length >= 2) payloads.push(digestPayload(digest, settings, now))
    const userSubs = ((subs ?? []) as Sub[]).filter((s) => s.user_id === userId)
    for (const p of payloads) sent += await sendToAll(userSubs, p)
  }
  return { rolled, sent, due: due.length }
}

/** Tekrarlayan "hatırlatma" türündeki öğeleri, zamanı geçince bir sonraki tekrara taşır. */
async function rollForward(item: Item, settings: ScheduleSettings, now: number): Promise<boolean> {
  if (item.kind !== 'reminder' || !item.recurrence || !item.due_date) return false
  const time = effectiveTime(item, settings)
  let date: string | null = item.due_date
  while (date && zonedToUtc(date, time, settings.timezone) < now - WINDOW_MS) {
    date = nextOccurrence(date, item.recurrence)
  }
  if (!date || date === item.due_date) return false
  const { error } = await supabase.from('items').update({ due_date: date }).eq('id', item.id)
  if (error) throw error
  item.due_date = date
  return true
}

function isDigestable(item: Item, ft: FireTime): boolean {
  return ft.type === 'overdue' || (ft.type === 'offset' && ft.minutes === 0 && !item.time_explicit)
}

const dateFmt = (date: string, tz: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: tz, ...opts }).format(new Date(zonedToUtc(date, '12:00', tz)))

function offsetLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} gün sonra`
  if (minutes % 60 === 0) return `${minutes / 60} saat sonra`
  return `${minutes} dk sonra`
}

function singlePayload(item: Item, ft: FireTime, s: ScheduleSettings): Payload {
  const kindLabel = item.kind === 'task' ? 'Görev' : 'Hatırlatma'
  const time = effectiveTime(item, s)
  const today = zonedParts(Date.now(), s.timezone).date
  const when = (date: string, t: string) =>
    `${date === today ? 'Bugün' : dateFmt(date, s.timezone, { day: 'numeric', month: 'long' })} ${t}`
  let line: string
  if (ft.type === 'overdue') {
    line = `Gecikmiş görev · ${dateFmt(item.due_date!, s.timezone, { day: 'numeric', month: 'long' })}`
  } else if (ft.type === 'absolute') {
    line = `${kindLabel}${item.due_date ? ` · ${when(item.due_date, time)}` : ''}`
  } else if (ft.minutes) {
    line = `${offsetLabel(ft.minutes)} · ${when(item.due_date!, time)}`
  } else {
    line = `${kindLabel} · ${time}`
  }
  const note = item.note?.split('\n')[0]?.trim()
  return {
    title: item.title,
    body: note ? `${line}\n${note}` : line,
    url: `#/oge/${item.id}`,
    tag: item.id,
  }
}

function digestPayload(entries: { item: Item; ft: FireTime }[], s: ScheduleSettings, now: number): Payload {
  const today = zonedParts(now, s.timezone).date
  const overdue = entries.filter((e) => e.ft.type === 'overdue')
  const tasks = entries.filter((e) => e.ft.type !== 'overdue' && e.item.kind === 'task')
  const reminders = entries.filter((e) => e.ft.type !== 'overdue' && e.item.kind === 'reminder')
  const counts = [
    tasks.length && `${tasks.length} görev`,
    reminders.length && `${reminders.length} hatırlatma`,
    overdue.length && `${overdue.length} gecikmiş`,
  ].filter(Boolean)
  const ordered = [...overdue, ...tasks, ...reminders].map((e) => e.item.title)
  const titles = ordered.slice(0, 3).join(', ') + (ordered.length > 3 ? `, +${ordered.length - 3}` : '')
  return {
    title: dateFmt(today, s.timezone, { day: 'numeric', month: 'long', weekday: 'long' }),
    body: `${counts.join(' · ')}\n${titles}`,
    url: `#/gun/${today}`,
    tag: `digest-${today}`,
  }
}

/** Uygulamadaki "Deneme bildirimi gönder" butonu: oturum açmış kullanıcının cihazlarına gönderir. */
async function testNotification(req: Request): Promise<Response> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const { data } = token ? await supabase.auth.getUser(token) : { data: { user: null } }
  if (!data.user) return new Response('forbidden', { status: 403, headers: CORS })
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .eq('user_id', data.user.id)
  const sent = await sendToAll((subs ?? []) as Sub[], {
    title: 'Günce',
    body: 'Bildirimler çalışıyor 🎉',
    url: '#/',
    tag: 'test',
  })
  return Response.json({ sent }, { headers: CORS })
}

async function sendToAll(subs: Sub[], payload: Payload): Promise<number> {
  let ok = 0
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: 'high' },
        )
        ok++
        await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('push failed', sub.endpoint.slice(0, 60), status, (e as Error).message)
        }
      }
    }),
  )
  return ok
}
