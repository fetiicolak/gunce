import { useMemo } from 'react'
import { isDone, occurrencesByDay, sortItems, useActiveItems } from '../lib/selectors'
import { useToday } from '../lib/useToday'
import AddBar from './AddBar'
import TaskRow from './TaskRow'

/** Bir günün öğeleri (tekrarlar dahil); bugünse gecikmişler de gösterilir. */
export default function DayAgenda({ date, compact }: { date: string; compact?: boolean }) {
  const items = useActiveItems()
  const today = useToday()

  const { late, occ } = useMemo(() => {
    const occ = occurrencesByDay(items, date, date).get(date) ?? []
    const late =
      date === today ? sortItems(items.filter((i) => i.kind === 'task' && i.due_date && i.due_date < today && !isDone(i, today))) : []
    return { late, occ }
  }, [items, date, today])

  return (
    <div className="flex flex-col gap-1.5">
      {late.length > 0 && (
        <>
          <div className="px-1 text-sm font-semibold text-danger">
            Gecikmiş <span className="font-normal text-muted">{late.length}</span>
          </div>
          {late.map((i) => (
            <TaskRow key={i.id} item={i} showList />
          ))}
          <div className="mt-2 px-1 text-sm font-semibold">O gün</div>
        </>
      )}
      {occ.length === 0 && !compact && <div className="py-6 text-center text-sm text-muted">Bu gün için bir şey yok.</div>}
      {occ.map((o) => (
        <TaskRow key={o.item.id + o.date} item={o.item} date={o.date} virtual={o.virtual} showList showDate={false} />
      ))}
      <div className="mt-1">
        <AddBar key={date} defaults={{ due_date: date }} />
      </div>
    </div>
  )
}
