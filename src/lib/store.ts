// Yerel-öncelikli veri katmanı:
// - Tüm veri bellekte (zustand) ve IndexedDB'de tutulur, uygulama çevrimdışı da çalışır.
// - Her değişiklik önce yerelde uygulanır, "outbox"a yazılır ve bağlantı olunca Supabase'e gönderilir.
// - Diğer cihazlardaki değişiklikler Realtime + artımlı çekme (updated_at imleci) ile gelir.
// - Çakışmada son yazan kazanır; bekleyen yerel değişikliği olan satır sunucudan ezilmez.

import { create } from 'zustand'
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { nextOccurrence, zonedParts } from '@shared/schedule.ts'
import { supabase } from './supabase'
import type { Item, List, Settings } from './types'

type Table = 'lists' | 'items' | 'settings'

interface Persisted {
  userId: string | null
  lists: Record<string, List>
  items: Record<string, Item>
  settings: Settings | null
  /** "tablo:id" -> sürüm; gönderilmeyi bekleyen satırlar */
  outbox: Record<string, number>
  cursor: string | null
}

interface State extends Persisted {
  ready: boolean
  online: boolean
  syncing: boolean
  lastError: string | null
}

const STORAGE_KEY = 'gunce-state'
const empty: Persisted = { userId: null, lists: {}, items: {}, settings: null, outbox: {}, cursor: null }

export const useStore = create<State>(() => ({
  ...empty,
  ready: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  lastError: null,
}))

const get = useStore.getState
const set = useStore.setState

export const uuid = () => crypto.randomUUID()

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul'
  } catch {
    return 'Europe/Istanbul'
  }
}

export function getSettings(): Settings {
  return get().settings ?? { user_id: get().userId ?? '', timezone: detectTimezone(), default_time: '09:00' }
}

export function useSettings(): Settings {
  const s = useStore((st) => st.settings)
  const userId = useStore((st) => st.userId)
  return s ?? { user_id: userId ?? '', timezone: detectTimezone(), default_time: '09:00' }
}

export function todayStr(): string {
  return zonedParts(Date.now(), getSettings().timezone).date
}

export function defaultTime(): string {
  return getSettings().default_time.slice(0, 5)
}

// ---------- Kalıcılık ----------

let persistTimer: ReturnType<typeof setTimeout> | undefined
function schedulePersist() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    const { userId, lists, items, settings, outbox, cursor } = get()
    if (userId) idbSet(STORAGE_KEY, { userId, lists, items, settings, outbox, cursor }).catch(() => {})
  }, 300)
}

// ---------- Yerel yazma ----------

function put<T extends Table>(table: T, row: T extends 'settings' ? Settings : T extends 'lists' ? List : Item) {
  const id = table === 'settings' ? (row as Settings).user_id : (row as List | Item).id
  const key = `${table}:${id}`
  set((s) => ({
    ...(table === 'settings'
      ? { settings: row as Settings }
      : { [table]: { ...(s[table as 'lists' | 'items'] as Record<string, unknown>), [id]: row } }),
    outbox: { ...s.outbox, [key]: (s.outbox[key] ?? 0) + 1 },
  }))
  schedulePersist()
  scheduleFlush()
}

// ---------- Sunucuya gönderme ----------

let flushTimer: ReturnType<typeof setTimeout> | undefined
let flushing = false

function scheduleFlush(delay = 400) {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, delay)
}

export async function flush() {
  if (localOnly) return set({ outbox: {} })
  if (flushing || !get().userId) return
  if (!navigator.onLine) return
  const outbox = get().outbox
  const keys = Object.keys(outbox)
  if (!keys.length) return
  flushing = true
  set({ syncing: true })
  try {
    for (const table of ['settings', 'lists', 'items'] as Table[]) {
      const tableKeys = keys.filter((k) => k.startsWith(table + ':'))
      if (!tableKeys.length) continue
      const versions = Object.fromEntries(tableKeys.map((k) => [k, outbox[k]]))
      const state = get()
      const rows = tableKeys
        .map((k) => {
          const id = k.slice(table.length + 1)
          return table === 'settings' ? state.settings : state[table as 'lists' | 'items'][id]
        })
        .filter(Boolean)
      if (rows.length) {
        const { data, error } = await supabase
          .from(table)
          .upsert(rows as object[], { onConflict: table === 'settings' ? 'user_id' : 'id' })
          .select()
        if (error) throw error
        for (const row of data ?? []) mergeRow(table, row, versions)
      }
      set((s) => {
        const next = { ...s.outbox }
        for (const k of tableKeys) if (next[k] === versions[k]) delete next[k]
        return { outbox: next }
      })
    }
    set({ lastError: null })
  } catch (e) {
    console.warn('flush failed', e)
    set({ lastError: (e as Error).message ?? String(e) })
    scheduleFlush(15_000)
  } finally {
    flushing = false
    set({ syncing: false })
    schedulePersist()
    if (Object.keys(get().outbox).some((k) => get().outbox[k] !== outbox[k])) scheduleFlush()
  }
}

// ---------- Sunucudan alma ----------

/** Sunucudan gelen satırı yerel duruma işler. `sentVersions` verilirse, gönderildikten sonra yerelde
 *  tekrar değişmiş satırlar ezilmez. */
function mergeRow(table: Table, row: Record<string, unknown>, sentVersions?: Record<string, number>) {
  const id = (table === 'settings' ? row.user_id : row.id) as string
  const key = `${table}:${id}`
  const pending = get().outbox[key]
  if (pending !== undefined && (!sentVersions || sentVersions[key] !== pending)) return
  set((s) => {
    if (table === 'settings') return { settings: row as unknown as Settings }
    const current = { ...(s[table as 'lists' | 'items'] as Record<string, unknown>) }
    if (row.deleted_at) delete current[id]
    else current[id] = normalize(table, row)
    const updated = row.updated_at as string
    return { [table]: current, cursor: !s.cursor || updated > s.cursor ? updated : s.cursor }
  })
  schedulePersist()
}

function normalize(table: Table, row: Record<string, unknown>) {
  if (table === 'items') {
    return {
      ...row,
      due_time: row.due_time ? (row.due_time as string).slice(0, 5) : null,
      steps: row.steps ?? [],
      reminders: row.reminders ?? [],
    }
  }
  return row
}

let pulling = false
export async function pull() {
  const userId = get().userId
  if (localOnly || pulling || !userId || !navigator.onLine) return
  pulling = true
  set({ syncing: true })
  try {
    // Eşzamanlı işlemlerde kaçırmamak için imleçten 2 dk geri gidilir; birleştirme idempotent.
    // Sunucu silinmiş satırları 30 gün sonra tamamen siler; 25 günden uzun süre eşitlenmemiş
    // bir cihaz o silmeleri kaçırmasın diye baştan tam çekim yapar.
    let cursor = get().cursor
    if (cursor && Date.now() - new Date(cursor).getTime() > 25 * 86_400_000) cursor = null
    const since = cursor ? new Date(new Date(cursor).getTime() - 120_000).toISOString() : null
    for (const table of ['lists', 'items'] as const) {
      const seen = new Set<string>()
      let from = 0
      for (;;) {
        let q = supabase.from(table).select('*').order('updated_at').range(from, from + 999)
        if (since) q = q.gt('updated_at', since)
        else q = q.is('deleted_at', null)
        const { data, error } = await q
        if (error) throw error
        for (const row of data ?? []) {
          seen.add(row.id)
          mergeRow(table, row)
        }
        if (!data || data.length < 1000) break
        from += 1000
      }
      if (!since) {
        // Tam çekimde sunucuda olmayan (ve gönderilmeyi beklemeyen) yerel satırları kaldır
        set((s) => {
          const next = { ...(s[table] as Record<string, unknown>) }
          for (const id of Object.keys(next)) if (!seen.has(id) && s.outbox[`${table}:${id}`] === undefined) delete next[id]
          return { [table]: next }
        })
      }
    }
    const { data: settings, error } = await supabase.from('settings').select('*').maybeSingle()
    if (error) throw error
    if (settings) mergeRow('settings', { ...settings, default_time: settings.default_time.slice(0, 5) })
    set({ lastError: null })
  } catch (e) {
    console.warn('pull failed', e)
    set({ lastError: (e as Error).message ?? String(e) })
  } finally {
    pulling = false
    set({ syncing: false })
  }
}

// ---------- Oturum yaşam döngüsü ----------

let channel: RealtimeChannel | null = null
/** Geliştirme demo modu: Supabase olmadan yalnızca yerelde çalışır */
let localOnly = false
let listenersBound = false

export async function initStore(userId: string, opts: { localOnly?: boolean } = {}) {
  localOnly = !!opts.localOnly
  const saved = (await idbGet(STORAGE_KEY).catch(() => null)) as Persisted | null
  if (saved && saved.userId === userId) set({ ...saved, ready: true })
  else set({ ...empty, userId, ready: true })

  await pull()
  await ensureDefaults(userId)
  flush()
  if (localOnly) return

  channel?.unsubscribe()
  channel = supabase.channel('gunce-sync')
  for (const table of ['lists', 'items', 'settings'] as const) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown>
        if (!row || !Object.keys(row).length) return
        if (table === 'settings' && typeof row.default_time === 'string') row.default_time = row.default_time.slice(0, 5)
        mergeRow(table, row)
      },
    )
  }
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') pull()
  })

  if (!listenersBound) {
    listenersBound = true
    window.addEventListener('online', () => {
      set({ online: true })
      pull().then(flush)
    })
    window.addEventListener('offline', () => set({ online: false }))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pull().then(flush)
    })
    setInterval(() => {
      if (document.visibilityState === 'visible') flush()
    }, 30_000)
  }
}

async function ensureDefaults(userId: string) {
  // Sadece sunucu gerçekten boşsa oluştur (çevrimdışıysa sonraki açılışa kalır)
  if (!localOnly && (!navigator.onLine || get().lastError)) return
  if (!get().settings) {
    put('settings', { user_id: userId, timezone: detectTimezone(), default_time: '09:00' })
  }
  // Varsayılan liste kimliği kullanıcı kimliğiyle aynıdır; böylece iki cihaz aynı listeyi üretir.
  if (!get().lists[userId]) {
    const now = new Date().toISOString()
    put('lists', {
      id: userId,
      user_id: userId,
      name: 'Görevler',
      color: 'blue',
      icon: 'home',
      position: 0,
      is_default: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })
  }
}

export async function resetStore() {
  channel?.unsubscribe()
  channel = null
  await idbDel(STORAGE_KEY).catch(() => {})
  set({ ...empty, ready: false })
}

// ---------- Listeler ----------

export function createList(name: string, color: List['color'] = 'blue'): List {
  const { userId, lists } = get()
  const now = new Date().toISOString()
  const maxPos = Math.max(0, ...Object.values(lists).map((l) => l.position))
  const list: List = {
    id: uuid(),
    user_id: userId!,
    name,
    color,
    icon: 'list',
    position: maxPos + 1,
    is_default: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  put('lists', list)
  return list
}

export function updateList(id: string, patch: Partial<List>) {
  const list = get().lists[id]
  if (list) put('lists', { ...list, ...patch })
}

export function deleteList(id: string) {
  const { lists, items } = get()
  const list = lists[id]
  if (!list || list.is_default) return
  const now = new Date().toISOString()
  for (const item of Object.values(items)) if (item.list_id === id) deleteItem(item.id)
  // Silinen satır gönderilene kadar yerelde işaretli kalır; seçiciler deleted_at olanları gizler
  put('lists', { ...list, deleted_at: now })
}

// ---------- Öğeler ----------

export type NewItem = Partial<Item> & { title: string }

export function createItem(input: NewItem): Item {
  const { userId } = get()
  const now = new Date().toISOString()
  const item: Item = {
    id: uuid(),
    user_id: userId!,
    list_id: userId!,
    kind: 'task',
    note: '',
    due_date: null,
    due_time: null,
    time_explicit: false,
    important: false,
    my_day: null,
    recurrence: null,
    steps: [],
    reminders: [],
    completed_at: null,
    position: -Date.now(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...input,
  }
  if (item.due_date && !input.reminders) item.reminders = [{ id: uuid(), type: 'offset', minutes: 0 }]
  if (item.due_date && !item.due_time) item.due_time = defaultTime()
  put('items', item)
  return item
}

export function updateItem(id: string, patch: Partial<Item>) {
  const item = get().items[id]
  if (!item) return
  const next = { ...item, ...patch }
  // Tarih ilk kez verildiyse ve hiç hatırlatma yoksa "tam zamanında" ekle
  if (patch.due_date && !item.due_date && !patch.reminders && next.reminders.length === 0) {
    next.reminders = [{ id: uuid(), type: 'offset', minutes: 0 }]
  }
  if (next.due_date && !next.due_time) next.due_time = defaultTime()
  if (!next.due_date) {
    next.recurrence = null
    next.reminders = next.reminders.filter((r) => r.type === 'absolute')
  }
  put('items', next)
}

export function deleteItem(id: string) {
  const item = get().items[id]
  if (!item) return
  put('items', { ...item, deleted_at: new Date().toISOString() })
}

/** Görevi tamamlar/geri alır. Tekrarlayan görev tamamlanınca bir sonraki tekrarı oluşturulur. */
export function toggleComplete(id: string) {
  const item = get().items[id]
  if (!item) return
  if (item.completed_at) {
    updateItem(id, { completed_at: null })
    return
  }
  if (item.recurrence && item.due_date) {
    const today = todayStr()
    let next = nextOccurrence(item.due_date, item.recurrence)
    while (next && next < today) next = nextOccurrence(next, item.recurrence)
    if (next) {
      createItem({
        ...item,
        id: uuid(),
        due_date: next,
        my_day: null,
        completed_at: null,
        steps: item.steps.map((s) => ({ ...s, done: false })),
        created_at: new Date().toISOString(),
      })
    }
    updateItem(id, { completed_at: new Date().toISOString(), recurrence: null })
    return
  }
  updateItem(id, { completed_at: new Date().toISOString() })
}

export function updateSettings(patch: Partial<Settings>) {
  put('settings', { ...getSettings(), ...patch })
}
