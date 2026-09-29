import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { addDays, mondayIndex, parseDate, weekday, type Recurrence, type Reminder } from '@shared/schedule.ts'

export const toDate = (s: string) => {
  const { y, m, d } = parseDate(s)
  return new Date(y, m - 1, d)
}

export const fmt = (s: string, pattern: string) => format(toDate(s), pattern, { locale: tr })

export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] // Pazartesi'den başlar
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

/** "Bugün", "Yarın", "Dün", "Cum, 3 Eki" gibi kısa etiket. */
export function relativeDay(date: string, today: string): string {
  if (date === today) return 'Bugün'
  if (date === addDays(today, 1)) return 'Yarın'
  if (date === addDays(today, -1)) return 'Dün'
  const sameYear = date.slice(0, 4) === today.slice(0, 4)
  return fmt(date, sameYear ? 'EEE, d MMM' : 'd MMM yyyy')
}

export function longDay(date: string): string {
  return fmt(date, 'd MMMM EEEE')
}

export function startOfWeek(date: string): string {
  return addDays(date, -mondayIndex(weekday(date)))
}

export function startOfMonth(date: string): string {
  return date.slice(0, 8) + '01'
}

export function recurrenceLabel(r: Recurrence | null): string {
  if (!r) return 'Tekrar yok'
  const n = r.interval > 1 ? r.interval : 0
  switch (r.freq) {
    case 'daily':
      return n ? `${n} günde bir` : 'Her gün'
    case 'weekly': {
      const days = [...(r.byWeekday ?? [])].map(mondayIndex).sort()
      if (!n && days.length === 5 && days.join() === '0,1,2,3,4') return 'Hafta içi her gün'
      const names = days.map((d) => WEEKDAYS_SHORT[d]).join(', ')
      return `${n ? `${n} haftada bir` : 'Her hafta'}${names ? ` · ${names}` : ''}`
    }
    case 'monthly':
      return n ? `${n} ayda bir` : 'Her ay'
    case 'yearly':
      return n ? `${n} yılda bir` : 'Her yıl'
  }
}

export function reminderLabel(r: Reminder): string {
  if (r.type === 'absolute') {
    const [d, t] = r.at.split('T')
    return `${fmt(d, 'd MMM')} ${t}`
  }
  const m = r.minutes
  if (m === 0) return 'Tam zamanında'
  if (m % 1440 === 0) return `${m / 1440} gün önce`
  if (m % 60 === 0) return `${m / 60} saat önce`
  return `${m} dk önce`
}
