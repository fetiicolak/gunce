import { useRef, useState } from 'react'
import { Bell, CalendarDays, Repeat, Star, StickyNote, Sun, Trash2 } from 'lucide-react'
import { deleteItem, toggleComplete, updateItem, useStore } from '../lib/store'
import { isDone, overdue, useSettings } from '../lib/selectors'
import { relativeDay } from '../lib/dates'
import { useOpenItem } from '../lib/nav'
import { useNow, useToday } from '../lib/useToday'
import { LIST_COLORS, type Item } from '../lib/types'
import { Checkbox, cx } from './ui'

export default function TaskRow({
  item,
  date,
  virtual,
  showList,
  showDate = true,
}: {
  item: Item
  /** Takvimde gösterilen tekrar tarihi */
  date?: string
  virtual?: boolean
  showList?: boolean
  showDate?: boolean
}) {
  const open = useOpenItem()
  const today = useToday()
  useNow()
  const settings = useSettings()
  const list = useStore((s) => s.lists[item.list_id])
  const color = LIST_COLORS[list?.color ?? 'blue']
  const done = !virtual && isDone(item, today)
  const late = !virtual && overdue(item, settings)
  const shownDate = date ?? item.due_date
  const stepsDone = item.steps.filter((s) => s.done).length

  const swipe = useSwipeToDelete(!virtual, () => {
    if (!confirm(`"${item.title}" silinsin mi?\nBu işlem geri alınamaz.`)) return false
    deleteItem(item.id)
    return true
  })

  const meta: React.ReactNode[] = []
  if (showList && list) meta.push(<span key="l">{list.name}</span>)
  if (item.my_day === today && !showDate) meta.push(<Sun key="md" className="h-3 w-3" />)
  if (item.steps.length) meta.push(<span key="s">{`${stepsDone}/${item.steps.length}`}</span>)
  if (shownDate && showDate) {
    meta.push(
      <span key="d" className={cx('inline-flex items-center gap-1', late ? 'text-danger' : shownDate === today && 'text-accent')}>
        <CalendarDays className="h-3 w-3" />
        {relativeDay(shownDate, today)}
      </span>,
    )
  }
  if (shownDate && item.time_explicit && item.due_time) meta.push(<span key="t">{item.due_time}</span>)
  if (item.recurrence) meta.push(<Repeat key="r" className="h-3 w-3" />)
  const onlyDefault = item.reminders.length === 1 && item.reminders[0].type === 'offset' && item.reminders[0].minutes === 0
  if (item.reminders.length && !onlyDefault && item.kind === 'task') meta.push(<Bell key="b" className="h-3 w-3" />)
  if (item.note.trim()) meta.push(<StickyNote key="n" className="h-3 w-3" />)

  return (
    <div className="relative overflow-clip rounded-lg">
      {swipe.dx < 0 && (
        <div className="absolute inset-0 flex items-center justify-end gap-2 bg-danger px-5 text-sm font-medium text-white">
          <Trash2 className="h-5 w-5" /> Sil
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!swipe.consumeClick()) open(item.id)
        }}
        onKeyDown={(e) => e.key === 'Enter' && open(item.id)}
        {...swipe.handlers}
        style={{
          transform: swipe.dx ? `translateX(${swipe.dx}px)` : undefined,
          transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
        }}
        className="relative flex cursor-pointer touch-pan-y select-none items-center gap-3 rounded-lg bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors hover:bg-surface-2"
      >
        {item.kind === 'task' ? (
          <Checkbox checked={done} onChange={() => toggleComplete(item.id)} color={color} disabled={virtual} />
        ) : (
          <span
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
            style={{ background: done ? 'var(--c-surface-2)' : color + '22', color: done ? 'var(--c-muted)' : color }}
          >
            <Bell className="h-3 w-3" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className={cx('truncate text-[15px]', done && 'text-muted line-through')}>{item.title}</div>
          {meta.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              {meta.flatMap((m, i) => (i ? [<span key={'sep' + i}>·</span>, m] : [m]))}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Önemli"
          onClick={(e) => {
            e.stopPropagation()
            updateItem(item.id, { important: !item.important })
          }}
          className="p-1"
        >
          <Star className={cx('h-4.5 w-4.5', item.important ? 'fill-star text-star' : 'text-muted')} />
        </button>
      </div>
    </div>
  )
}

const SWIPE_THRESHOLD = 90

/** Satırı sola kaydırınca silme. Dikey kaydırma (listeyi kaydırmak) tarayıcıda kalır. */
function useSwipeToDelete(enabled: boolean, onDelete: () => boolean) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; axis: 'h' | 'v' | null } | null>(null)
  // Kaydırma bitiminden hemen sonra gelen tıklama detay açmasın
  const swipedAt = useRef(0)
  const dxRef = useRef(0)

  const setOffset = (v: number) => {
    dxRef.current = v
    setDx(v)
  }

  const end = () => {
    const s = start.current
    start.current = null
    setDragging(false)
    if (!s || s.axis !== 'h') return
    swipedAt.current = Date.now()
    if (dxRef.current <= -SWIPE_THRESHOLD) {
      setOffset(-window.innerWidth)
      // Onay penceresi kayma animasyonu bittikten sonra açılsın
      setTimeout(() => {
        if (!onDelete()) setOffset(0)
      }, 180)
    } else {
      setOffset(0)
    }
  }

  return {
    dx,
    dragging,
    /** Kaydırma hareketinin ardından gelen tıklamayı yut (detay açılmasın) */
    consumeClick: () => Date.now() - swipedAt.current < 400,
    handlers: enabled
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return
            start.current = { x: e.clientX, y: e.clientY, axis: null }
          },
          onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
            const s = start.current
            if (!s) return
            const ddx = e.clientX - s.x
            const ddy = e.clientY - s.y
            if (!s.axis) {
              if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy)) {
                s.axis = 'h'
                setDragging(true)
                e.currentTarget.setPointerCapture(e.pointerId)
              } else if (Math.abs(ddy) > 10) {
                s.axis = 'v'
              }
            }
            if (s.axis === 'h') setOffset(Math.min(0, ddx))
          },
          onPointerUp: end,
          onPointerCancel: end,
        }
      : {},
  }
}
