// Harcama Planı ve Aylık Plan için ortak hesaplar.
// Hem istemci (Vite) hem dispatch fonksiyonu (Deno) kullanır; dış bağımlılık yok.

import { addDays, daysInMonth, zonedToUtc, type ScheduleSettings } from './schedule.ts'

export interface ExpenseRow {
  id: string
  user_id: string
  series_id: string
  title: string
  amount: number
  due_date: string
  recurring: boolean
  paid_on: string | null
  note: string
  deleted_at: string | null
}

export interface EventRow {
  id: string
  user_id: string
  date: string
  title: string
  time: string | null
  note: string
  deleted_at: string | null
}

/** "YYYY-MM-DD" → "YYYY-MM" */
export const monthOf = (date: string) => date.slice(0, 7)

/** Ay içinde aynı gün; ay o kadar uzun değilse son gün (31 → 30 Kasım). */
export function sameDayIn(month: string, date: string): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const d = Math.min(Number(date.slice(8, 10)), daysInMonth(y, m))
  return `${month}-${String(d).padStart(2, '0')}`
}

/** Seri + ay'dan her cihazda aynı çıkan, UUID biçiminde kimlik (aynı tekrar iki kez oluşmasın). */
export function seriesInstanceId(seriesId: string, month: string): string {
  const input = `${seriesId}|${month}`
  // 4 farklı tohumla FNV-1a → 128 bit
  const parts = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => {
    let h = seed >>> 0
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  })
  const hex = parts.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** `month` ayında henüz satırı olmayan, "her ay tekrarla" serilerinin o aydaki kopyaları.
 *  Kaynak: serinin o aydan önceki en son satırı; o satırda tekrar açıksa kopya üretilir. */
export function missingRecurring<T extends ExpenseRow>(rows: T[], month: string): T[] {
  const bySeries = new Map<string, T[]>()
  for (const r of rows) {
    if (r.deleted_at) continue
    const list = bySeries.get(r.series_id) ?? []
    list.push(r)
    bySeries.set(r.series_id, list)
  }
  const out: T[] = []
  for (const [seriesId, list] of bySeries) {
    if (list.some((r) => monthOf(r.due_date) === month)) continue
    const before = list.filter((r) => monthOf(r.due_date) < month).sort((a, b) => a.due_date.localeCompare(b.due_date))
    const last = before.at(-1)
    if (!last?.recurring) continue
    // Gün serinin ilk harcamasından alınır: 31'i Kasım'da 30'a düşse de Aralık'ta yine 31 olur
    const anchor = [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
    out.push({ ...last, id: seriesInstanceId(seriesId, month), due_date: sameDayIn(month, anchor.due_date), paid_on: null })
  }
  return out
}

export interface PlanFire {
  key: string
  at: number
  kind: 'expense' | 'event-eve' | 'event-day'
}

/** Harcama: günü gelince (varsayılan saatte), ödenmediyse. */
export function expenseFireTimes(e: ExpenseRow, s: ScheduleSettings): PlanFire[] {
  if (e.deleted_at || e.paid_on) return []
  return [{ key: `exp|${e.due_date}`, at: zonedToUtc(e.due_date, s.default_time.slice(0, 5), s.timezone), kind: 'expense' }]
}

/** Etkinlik: bir gün önce ve o gün, varsayılan saatte (etkinlik saati daha erkense o gün 1 saat önce). */
export function eventFireTimes(ev: EventRow, s: ScheduleSettings): PlanFire[] {
  if (ev.deleted_at) return []
  const def = s.default_time.slice(0, 5)
  let dayTime = def
  const t = ev.time?.slice(0, 5)
  if (t && t <= def) {
    const [h, m] = t.split(':').map(Number)
    const mins = Math.max(0, h * 60 + m - 60)
    dayTime = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
  return [
    { key: `ev-eve|${ev.date}`, at: zonedToUtc(addDays(ev.date, -1), def, s.timezone), kind: 'event-eve' },
    { key: `ev-day|${ev.date}`, at: zonedToUtc(ev.date, dayTime, s.timezone), kind: 'event-day' },
  ]
}
