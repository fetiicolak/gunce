import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarRange, ChevronLeft, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { addDays } from '@shared/schedule.ts'
import { monthOf } from '@shared/plans.ts'
import { askConfirm } from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import MonthNav from '../components/MonthNav'
import { cx, IconButton, inputCls, useIsDesktop } from '../components/ui'
import { fmt, startOfWeek, WEEKDAYS_SHORT } from '../lib/dates'
import { createEvent, deleteEvent, updateEvent, useStore } from '../lib/store'
import type { PlanEvent } from '../lib/types'
import { useToday } from '../lib/useToday'
import { Field } from './ExpensesPage'

export const PLAN_COLOR = '#7c4dcc'

const byTime = (a: PlanEvent, b: PlanEvent) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.created_at.localeCompare(b.created_at)

export default function MonthPlanPage() {
  const today = useToday()
  const current = monthOf(today)
  const [params, setParams] = useSearchParams()
  const month = params.get('ay') ?? current
  const setMonth = (m: string) => setParams(m === current ? {} : { ay: m }, { replace: true })
  const all = useStore((s) => s.events)
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const [openDay, setOpenDay] = useState<string | null>(null)

  // Ayın görünen haftaları (Pazartesi'den başlayan, 5 ya da 6 satır)
  const days = useMemo(() => {
    const start = startOfWeek(`${month}-01`)
    const out: string[] = []
    for (let d = start; out.length < 42; d = addDays(d, 1)) {
      if (out.length % 7 === 0 && out.length >= 28 && monthOf(d) !== month) break
      out.push(d)
    }
    return out
  }, [month])

  const byDay = useMemo(() => {
    const map = new Map<string, PlanEvent[]>()
    for (const ev of Object.values(all)) {
      if (ev.deleted_at) continue
      const list = map.get(ev.date) ?? []
      list.push(ev)
      map.set(ev.date, list)
    }
    for (const list of map.values()) list.sort(byTime)
    return map
  }, [all])

  const monthCount = days.filter((d) => monthOf(d) === month).reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 px-4 md:px-8">
        <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-8">
          <div className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-auto" style={{ color: PLAN_COLOR }}>
            {!isDesktop && (
              <IconButton onClick={() => navigate('/listeler')} className="-ml-2" aria-label="Geri" style={{ color: PLAN_COLOR }}>
                <ChevronLeft className="h-6 w-6" />
              </IconButton>
            )}
            <CalendarRange className="h-6 w-6" />
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">Aylık Plan</h1>
          </div>
          <MonthNav month={month} current={current} onChange={setMonth} />
        </div>
        <div className="mt-1 text-sm text-muted">
          {monthCount ? `Bu ay ${monthCount} etkinlik` : 'Bir güne dokunup etkinlik yaz.'}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-3 md:px-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-xs font-medium text-muted">
            {WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="py-1.5">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const inMonth = monthOf(d) === month
              const events = byDay.get(d) ?? []
              const max = isDesktop ? 4 : 3
              return (
                <div
                  key={d}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenDay(d)}
                  onKeyDown={(e) => e.key === 'Enter' && setOpenDay(d)}
                  aria-label={fmt(d, 'd MMMM EEEE')}
                  className={cx(
                    'flex min-h-20 min-w-0 flex-col gap-0.5 border-line p-1 transition-colors hover:bg-surface-2 md:min-h-28 md:p-1.5',
                    i % 7 !== 6 && 'border-r',
                    i < days.length - 7 && 'border-b',
                    !inMonth && 'bg-surface-2/50 opacity-50',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium',
                      d === today ? 'text-white' : 'text-ink',
                    )}
                    style={d === today ? { background: PLAN_COLOR } : undefined}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {events.slice(0, max).map((ev) => (
                    <span
                      key={ev.id}
                      className="truncate rounded px-1 py-px text-[10px] leading-tight md:text-xs"
                      style={{ background: PLAN_COLOR + '1c', color: PLAN_COLOR }}
                      title={ev.location ? `${ev.title} · ${ev.location}` : ev.title}
                    >
                      {isDesktop && ev.time && <span className="opacity-70">{ev.time} </span>}
                      {ev.title}
                    </span>
                  ))}
                  {events.length > max && <span className="px-1 text-[10px] text-muted md:text-xs">+{events.length - max}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {openDay && <DayEvents date={openDay} events={byDay.get(openDay) ?? []} onClose={() => setOpenDay(null)} />}
    </div>
  )
}

/** Bir günün etkinlikleri: listele, ekle, düzenle, sil. */
function DayEvents({ date, events, onClose }: { date: string; events: PlanEvent[]; onClose: () => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(events.length ? null : 'new')

  return (
    <Modal title={fmt(date, 'd MMMM EEEE')} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {events.map((ev) =>
          editing === ev.id ? (
            <EventForm key={ev.id} date={date} event={ev} onDone={() => setEditing(null)} />
          ) : (
            <div key={ev.id} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="break-words">
                  {ev.time && <span className="mr-1.5 font-medium" style={{ color: PLAN_COLOR }}>{ev.time}</span>}
                  {ev.title}
                </div>
                {ev.location && (
                  <div className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">{ev.location}</span>
                  </div>
                )}
                {ev.note && <div className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{ev.note}</div>}
              </div>
              <IconButton onClick={() => setEditing(ev.id)} aria-label="Düzenle" className="h-8 w-8">
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton
                aria-label="Sil"
                className="h-8 w-8 hover:text-danger"
                onClick={async () => {
                  if (await askConfirm({ title: `"${ev.title}" silinsin mi?`, confirmText: 'Sil', danger: true })) deleteEvent(ev.id)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ),
        )}
        {editing === 'new' ? (
          <EventForm date={date} onDone={() => (events.length ? setEditing(null) : onClose())} />
        ) : (
          <button onClick={() => setEditing('new')} className="flex items-center gap-2 rounded-lg px-1 py-2 text-left text-accent">
            <Plus className="h-5 w-5" /> Etkinlik ekle
          </button>
        )}
        <p className="pt-1 text-xs text-muted">Bir gün önce ve etkinlik günü bildirim gelir.</p>
      </div>
    </Modal>
  )
}

function EventForm({ date, event, onDone }: { date: string; event?: PlanEvent; onDone: () => void }) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [time, setTime] = useState(event?.time ?? '')
  const [day, setDay] = useState(event?.date ?? date)
  const [location, setLocation] = useState(event?.location ?? '')
  const [note, setNote] = useState(event?.note ?? '')

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-line p-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        const data = { title: title.trim(), time: time || null, date: day, location: location.trim(), note }
        if (event) updateEvent(event.id, data)
        else createEvent(data)
        onDone()
      }}
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ne yapacaksın?" className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Saat (isteğe bağlı)">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Gün">
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mekan (isteğe bağlı)" className={cx(inputCls, 'pl-9')} />
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Not" className={cx(inputCls, 'resize-none')} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2">
          Vazgeç
        </button>
        <button type="submit" disabled={!title.trim()} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
          Kaydet
        </button>
      </div>
    </form>
  )
}
