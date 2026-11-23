import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths } from '@shared/schedule.ts'
import { MONTHS } from '../lib/dates'
import { IconButton } from './ui'

/** `< Kasım >` ay seçici ve "Bu ay" kısayolu. `month`: "YYYY-MM". */
export default function MonthNav({ month, current, onChange }: { month: string; current: string; onChange: (m: string) => void }) {
  const y = month.slice(0, 4)
  const label = `${MONTHS[Number(month.slice(5, 7)) - 1]}${y === current.slice(0, 4) ? '' : ` ${y}`}`
  const move = (n: number) => onChange(addMonths(`${month}-01`, n).slice(0, 7))
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        <IconButton onClick={() => move(-1)} aria-label="Önceki ay">
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <span className="min-w-24 text-center text-[15px] font-semibold whitespace-nowrap">{label}</span>
        <IconButton onClick={() => move(1)} aria-label="Sonraki ay">
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>
      {month !== current && (
        <button onClick={() => onChange(current)} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-medium text-ink hover:text-accent">
          Bu ay
        </button>
      )}
    </div>
  )
}
