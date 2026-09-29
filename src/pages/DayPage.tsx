import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays } from '@shared/schedule.ts'
import DayAgenda from '../components/DayAgenda'
import { IconButton } from '../components/ui'
import { longDay, relativeDay } from '../lib/dates'
import { useToday } from '../lib/useToday'

export default function DayPage() {
  const { date } = useParams()
  const navigate = useNavigate()
  const today = useToday()
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return <Navigate to="/takvim" replace />

  const go = (d: string) => navigate(`/gun/${d}`, { replace: true })
  const rel = relativeDay(date, today)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 px-4 md:px-8">
        <div className="flex items-center gap-1 pt-3 md:pt-8">
          <IconButton onClick={() => navigate(`/takvim?t=${date}`)} aria-label="Takvim" className="-ml-2 text-[#1f8f98]">
            <CalendarDays className="h-5 w-5" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight text-[#1f8f98] md:text-3xl">{longDay(date)}</h1>
            {['Bugün', 'Yarın', 'Dün'].includes(rel) && <div className="text-sm text-muted">{rel}</div>}
          </div>
          <IconButton onClick={() => go(addDays(date, -1))} aria-label="Önceki gün">
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton onClick={() => go(addDays(date, 1))} aria-label="Sonraki gün">
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-8">
        <div className="mx-auto max-w-3xl">
          <DayAgenda date={date} />
        </div>
      </div>
    </div>
  )
}
