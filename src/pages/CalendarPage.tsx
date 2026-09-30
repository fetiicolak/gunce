import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CalendarDays, ChevronLeft, ChevronRight, Repeat } from 'lucide-react'
import { addDays, addMonths } from '@shared/schedule.ts'
import DayAgenda from '../components/DayAgenda'
import { cx, IconButton, Segmented, useIsDesktop } from '../components/ui'
import { isDone, occurrencesByDay, overdue, useActiveItems, useSettings, type Occurrence } from '../lib/selectors'
import { fmt, longDay, MONTHS, relativeDay, startOfMonth, startOfWeek, WEEKDAYS_SHORT } from '../lib/dates'
import { updateItem, useStore } from '../lib/store'
import { useOpenItem } from '../lib/nav'
import { useToday } from '../lib/useToday'
import { LIST_COLORS } from '../lib/types'

type View = 'ay' | 'hafta'
const VIEW_KEY = 'gunce-calendar-view'

export default function CalendarPage() {
  const today = useToday()
  const isDesktop = useIsDesktop()
  const [params, setParams] = useSearchParams()
  const [storedView, setStoredView] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || 'ay'
    } catch {
      return 'ay'
    }
  })
  const view = (params.get('g') as View) || storedView
  const selected = params.get('t') || today
  const items = useActiveItems()

  const update = (patch: { g?: View; t?: string }) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (patch.g) next.set('g', patch.g)
        if (patch.t) next.set('t', patch.t)
        return next
      },
      { replace: true },
    )

  const setView = (g: View) => {
    setStoredView(g)
    try {
      localStorage.setItem(VIEW_KEY, g)
    } catch {
      /* depolama kapalı olabilir */
    }
    update({ g })
  }

  const days = useMemo(() => {
    const start = view === 'ay' ? startOfWeek(startOfMonth(selected)) : startOfWeek(selected)
    return Array.from({ length: view === 'ay' ? 42 : 7 }, (_, i) => addDays(start, i))
  }, [view, selected])

  const occ = useMemo(() => occurrencesByDay(items, days[0], days[days.length - 1]), [items, days])

  const move = (dir: 1 | -1) =>
    update({ t: view === 'ay' ? startOfMonth(addMonths(startOfMonth(selected), dir)) : addDays(selected, 7 * dir) })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const itemId = e.active.data.current?.itemId as string | undefined
    const target = e.over?.id as string | undefined
    if (itemId && target) {
      const item = useStore.getState().items[itemId]
      if (item && item.due_date !== target) updateItem(itemId, { due_date: target })
    }
  }

  const { y, m } = { y: Number(selected.slice(0, 4)), m: Number(selected.slice(5, 7)) }
  const title =
    view === 'ay'
      ? `${MONTHS[m - 1]} ${y}`
      : days[0].slice(5, 7) === days[6].slice(5, 7)
        ? `${fmt(days[0], 'd')} – ${fmt(days[6], 'd MMMM')}`
        : `${fmt(days[0], 'd MMM')} – ${fmt(days[6], 'd MMM')}`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 px-4 md:px-8">
        <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-8">
          <div className="flex min-w-0 basis-full items-center gap-2 text-[#1f8f98] sm:flex-1 sm:basis-auto">
            <CalendarDays className="h-6 w-6" />
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          </div>
          <div className="flex flex-1 items-center gap-1 sm:flex-none">
            <IconButton onClick={() => move(-1)} aria-label="Önceki">
              <ChevronLeft className="h-5 w-5" />
            </IconButton>
            <button onClick={() => update({ t: today })} className="rounded-lg px-2 py-1 text-sm font-medium hover:bg-surface-2">
              Bugün
            </button>
            <IconButton onClick={() => move(1)} aria-label="Sonraki">
              <ChevronRight className="h-5 w-5" />
            </IconButton>
          </div>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'ay', label: 'Ay' },
              { value: 'hafta', label: 'Hafta' },
            ]}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="shrink-0 px-2 pt-3 md:px-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-6">
            {view === 'ay' ? (
              <MonthGrid days={days} occ={occ} selected={selected} month={selected.slice(0, 7)} onSelect={(t) => update({ t })} />
            ) : isDesktop ? (
              <WeekColumns days={days} occ={occ} selected={selected} onSelect={(t) => update({ t })} />
            ) : (
              <WeekRows days={days} occ={occ} selected={selected} onSelect={(t) => update({ t })} />
            )}
          </div>
        </DndContext>

        <section className="px-4 pb-6 pt-4 md:px-8 lg:w-96 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-line lg:px-4">
          <h2 className="mb-2 flex items-baseline gap-2 px-1">
            <span className="text-lg font-bold text-accent">{longDay(selected)}</span>
            {['Bugün', 'Yarın', 'Dün'].includes(relativeDay(selected, today)) && (
              <span className="text-sm text-muted">{relativeDay(selected, today)}</span>
            )}
          </h2>
          <DayAgenda date={selected} compact />
        </section>
      </div>
    </div>
  )
}

interface GridProps {
  days: string[]
  occ: Map<string, Occurrence[]>
  selected: string
  onSelect: (d: string) => void
}

function MonthGrid({ days, occ, selected, month, onSelect }: GridProps & { month: string }) {
  const today = useToday()
  const isDesktop = useIsDesktop()
  const max = isDesktop ? 4 : 2
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-muted">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = occ.get(d) ?? []
          return (
            <DayCell
              key={d}
              date={d}
              onSelect={onSelect}
              className={cx(
                'min-h-16 border-line p-0.5 md:min-h-28 md:p-1',
                i % 7 !== 6 && 'border-r',
                i < 35 && 'border-b',
                d.slice(0, 7) !== month && 'bg-surface-2/50',
                d === selected && 'bg-accent-soft ring-2 ring-inset ring-accent',
              )}
            >
              <div className="mb-0.5 flex justify-center md:justify-start">
                <span
                  className={cx(
                    'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs',
                    d === today
                      ? 'bg-accent font-semibold text-white'
                      : d === selected
                        ? 'font-bold text-accent ring-2 ring-accent'
                        : d.slice(0, 7) !== month
                          ? 'text-muted/60'
                          : 'text-ink',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {list.slice(0, max).map((o) => (
                  <Chip key={o.item.id + o.date} o={o} small={!isDesktop} />
                ))}
                {list.length > max && <span className="px-1 text-[10px] text-muted">+{list.length - max}</span>}
              </div>
            </DayCell>
          )
        })}
      </div>
    </div>
  )
}

function WeekColumns({ days, occ, selected, onSelect }: GridProps) {
  const today = useToday()
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line bg-surface">
      {days.map((d, i) => (
        <DayCell
          key={d}
          date={d}
          onSelect={onSelect}
          className={cx('min-h-[60vh] border-line p-1.5', i < 6 && 'border-r', d === selected && 'bg-accent-soft ring-2 ring-inset ring-accent')}
        >
          <div className="mb-2 text-center">
            <div className="text-xs text-muted">{WEEKDAYS_SHORT[i]}</div>
            <div
              className={cx(
                'mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-lg',
                d === today ? 'bg-accent font-semibold text-white' : d === selected ? 'font-bold text-accent ring-2 ring-accent' : '',
              )}
            >
              {Number(d.slice(8))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {(occ.get(d) ?? []).map((o) => (
              <Chip key={o.item.id + o.date} o={o} />
            ))}
          </div>
        </DayCell>
      ))}
    </div>
  )
}

function WeekRows({ days, occ, selected, onSelect }: GridProps) {
  const today = useToday()
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {days.map((d, i) => (
        <DayCell
          key={d}
          date={d}
          onSelect={onSelect}
          className={cx('flex gap-3 border-line px-3 py-2', i < 6 && 'border-b', d === selected && 'bg-accent-soft ring-2 ring-inset ring-accent')}
        >
          <div className="w-10 shrink-0 text-center">
            <div className="text-[11px] text-muted">{WEEKDAYS_SHORT[i]}</div>
            <div
              className={cx(
                'mx-auto flex h-7 w-7 items-center justify-center rounded-full',
                d === today ? 'bg-accent font-semibold text-white' : d === selected ? 'font-bold text-accent ring-2 ring-accent' : '',
              )}
            >
              {Number(d.slice(8))}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
            {(occ.get(d) ?? []).map((o) => (
              <Chip key={o.item.id + o.date} o={o} />
            ))}
          </div>
        </DayCell>
      ))}
    </div>
  )
}

function DayCell({
  date,
  onSelect,
  className,
  children,
}: {
  date: string
  onSelect: (d: string) => void
  className?: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(date)}
      className={cx('cursor-pointer transition-colors', className, isOver && 'bg-accent-soft!')}
    >
      {children}
    </div>
  )
}

function Chip({ o, small }: { o: Occurrence; small?: boolean }) {
  const open = useOpenItem()
  const today = useToday()
  const settings = useSettings()
  const list = useStore((s) => s.lists[o.item.list_id])
  const color = LIST_COLORS[list?.color ?? 'blue']
  const done = !o.virtual && isDone(o.item, today)
  const late = !o.virtual && overdue(o.item, settings)
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `${o.item.id}|${o.date}`,
    data: { itemId: o.item.id },
    disabled: o.virtual,
  })

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        open(o.item.id)
      }}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        borderLeftColor: color,
        background: color + '1c',
      }}
      className={cx(
        'flex w-full min-w-0 touch-manipulation items-center gap-1 rounded border-l-[3px] text-left',
        small ? 'px-0.5 py-px text-[10px] leading-tight' : 'px-1.5 py-1 text-xs',
        done && 'opacity-50',
        isDragging && 'relative z-50 shadow-lg',
        o.virtual && 'opacity-70',
      )}
    >
      {!small && o.item.time_explicit && o.item.due_time && <span className="shrink-0 text-muted">{o.item.due_time}</span>}
      <span className={cx('min-w-0 flex-1 truncate', done && 'line-through', late && 'text-danger')}>{o.item.title}</span>
      {!small && o.item.recurrence && <Repeat className="h-3 w-3 shrink-0 text-muted" />}
    </button>
  )
}
