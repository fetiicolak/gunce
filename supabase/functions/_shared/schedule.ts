// Hem istemci (Vite) hem dispatch fonksiyonu (Deno) tarafından kullanılır.
// Bu yüzden hiçbir dış bağımlılık içermez.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Pazar (JS Date ile aynı)

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  byWeekday?: Weekday[]
  until?: string | null
}

export type Reminder =
  | { id: string; type: 'offset'; minutes: number }
  | { id: string; type: 'absolute'; at: string } // YYYY-MM-DDTHH:mm, kullanıcının saat diliminde

export interface SchedulableItem {
  id: string
  kind: 'task' | 'reminder'
  due_date: string | null
  due_time: string | null
  time_explicit: boolean
  recurrence: Recurrence | null
  reminders: Reminder[]
  completed_at: string | null
  deleted_at: string | null
}

export interface ScheduleSettings {
  timezone: string
  default_time: string
}

export interface FireTime {
  key: string
  at: number
  type: 'offset' | 'absolute' | 'overdue'
  minutes?: number
}

// ---------- Tarih yardımcıları (YYYY-MM-DD metinleri üzerinde, saat diliminden bağımsız) ----------

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function parseDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return { y, m, d }
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseDate(s)
  return toDateStr(y, m, d + n)
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonths(s: string, n: number): string {
  const { y, m, d } = parseDate(s)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return toDateStr(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}

export function weekday(s: string): Weekday {
  const { y, m, d } = parseDate(s)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday
}

/** Pazartesi = 0 ... Pazar = 6 */
export const mondayIndex = (w: Weekday) => (w + 6) % 7

export function normTime(t: string | null | undefined): string | null {
  return t ? t.slice(0, 5) : null
}

// ---------- Tekrarlama ----------

/** `date` tarihinden kesinlikle sonraki ilk tekrarı döndürür; bitmişse null. */
export function nextOccurrence(date: string, rec: Recurrence): string | null {
  const interval = Math.max(1, rec.interval || 1)
  let next: string
  switch (rec.freq) {
    case 'daily':
      next = addDays(date, interval)
      break
    case 'weekly': {
      const days = [...new Set(rec.byWeekday?.length ? rec.byWeekday : [weekday(date)])]
        .map(mondayIndex)
        .sort((a, b) => a - b)
      const cur = mondayIndex(weekday(date))
      const later = days.find((d) => d > cur)
      if (later !== undefined) {
        next = addDays(date, later - cur)
      } else {
        const weekStart = addDays(date, -cur)
        next = addDays(weekStart, 7 * interval + days[0])
      }
      break
    }
    case 'monthly':
      next = addMonths(date, interval)
      break
    case 'yearly':
      next = addMonths(date, 12 * interval)
      break
  }
  if (rec.until && next > rec.until) return null
  return next
}

/** [from, to] aralığına düşen tekrar tarihleri (başlangıç tarihi dahil). */
export function occurrencesBetween(start: string, rec: Recurrence | null, from: string, to: string): string[] {
  const out: string[] = []
  let cur: string | null = start
  let guard = 0
  while (cur && cur <= to && guard++ < 1000) {
    if (cur >= from) out.push(cur)
    cur = rec ? nextOccurrence(cur, rec) : null
  }
  return out
}

// ---------- Saat dilimi ----------

function tzOffsetMs(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** Kullanıcının saat dilimindeki yerel tarih+saati UTC milisaniyeye çevirir. */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const { y, m, d } = parseDate(date)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let result = guess - tzOffsetMs(guess, tz)
  // Yaz saati geçişlerinde ikinci düzeltme
  result = guess - tzOffsetMs(result, tz)
  return result
}

/** Bir anın kullanıcının saat dilimindeki tarih ve saati. */
export function zonedParts(instant: number, tz: string): { date: string; time: string } {
  const local = new Date(instant + tzOffsetMs(instant, tz))
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  }
}

// ---------- Bildirim zamanları ----------

export function effectiveTime(item: SchedulableItem, settings: ScheduleSettings): string {
  return normTime(item.due_time) ?? normTime(settings.default_time) ?? '09:00'
}

/** Bir öğenin mevcut tekrarı için tüm bildirim anları. */
export function fireTimes(item: SchedulableItem, settings: ScheduleSettings): FireTime[] {
  if (item.deleted_at || item.completed_at) return []
  const tz = settings.timezone
  const out: FireTime[] = []
  for (const r of item.reminders ?? []) {
    if (r.type === 'offset' && item.due_date) {
      const occ = zonedToUtc(item.due_date, effectiveTime(item, settings), tz)
      out.push({ key: `${item.due_date}|${r.id}`, at: occ - r.minutes * 60_000, type: 'offset', minutes: r.minutes })
    } else if (r.type === 'absolute' && r.at) {
      const [d, t] = r.at.split('T')
      out.push({ key: `abs|${r.at}`, at: zonedToUtc(d, t, tz), type: 'absolute' })
    }
  }
  if (item.kind === 'task' && item.due_date) {
    const at = zonedToUtc(addDays(item.due_date, 1), normTime(settings.default_time) ?? '09:00', tz)
    out.push({ key: `${item.due_date}|overdue`, at, type: 'overdue' })
  }
  return out
}

export function isOverdue(item: SchedulableItem, settings: ScheduleSettings, now = Date.now()): boolean {
  if (item.kind !== 'task' || !item.due_date || item.completed_at || item.deleted_at) return false
  const today = zonedParts(now, settings.timezone).date
  if (item.due_date < today) return true
  if (item.due_date === today && item.time_explicit && item.due_time) {
    return zonedToUtc(item.due_date, normTime(item.due_time)!, settings.timezone) < now
  }
  return false
}
