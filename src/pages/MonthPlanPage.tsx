import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarRange, CalendarSearch, ChevronDown, ChevronLeft, Filter, MapPin, Maximize2, Minimize2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { addDays, addMonths, daysInMonth } from '@shared/schedule.ts'
import { monthOf } from '@shared/plans.ts'
import { askConfirm } from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import MonthNav from '../components/MonthNav'
import { chipCls, cx, DateInput, IconButton, inputCls, Segmented, useIsDesktop, useMediaQuery } from '../components/ui'
import { fmt, relativeDay, startOfWeek, WEEKDAYS_SHORT } from '../lib/dates'
import { createEvent, deleteEvent, updateEvent, useStore } from '../lib/store'
import type { PlanEvent } from '../lib/types'
import { useToday } from '../lib/useToday'
import { Field } from './ExpensesPage'

export const PLAN_COLOR = '#7c4dcc'

const byTime = (a: PlanEvent, b: PlanEvent) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.created_at.localeCompare(b.created_at)

/** Plan filtresi aynı adlı etkinlikleri birlikte gizler/gösterir ("Spor", "spor " aynı plan sayılır). */
const planKey = (title: string) => title.trim().toLocaleLowerCase('tr')

const HIDDEN_KEY = 'gunce-plan-hidden'
function readHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

const monthStart = (m: string) => `${m}-01`
const monthEnd = (m: string) => `${m}-${String(daysInMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)))).padStart(2, '0')}`

export default function MonthPlanPage() {
  const today = useToday()
  const current = monthOf(today)
  const [params, setParams] = useSearchParams()
  const all = useStore((s) => s.events)
  const isDesktop = useIsDesktop()
  const wide = useMediaQuery('(min-width: 1024px)')
  const navigate = useNavigate()

  // Görünen ay kaydırdıkça değişir; okla/bildirimden gelen ?ay= ile o aya kaydırılır
  const [focused, setFocused] = useState(params.get('ay') ?? current)
  const [scrollTarget, setScrollTarget] = useState<{ month: string; n: number }>({ month: params.get('ay') ?? current, n: 0 })
  const goMonth = (m: string) => setScrollTarget((t) => ({ month: m, n: t.n + 1 }))

  // Tarih filtresi: seçilmediyse görünen ay
  const from = params.get('bas')
  const to = params.get('bit') ?? from
  const range = from && to ? (from <= to ? [from, to] : [to, from]) : [monthStart(focused), monthEnd(focused)]
  const setRange = (a: string | null, b?: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('ay')
        if (a) next.set('bas', a)
        else next.delete('bas')
        if (a && b && b !== a) next.set('bit', b)
        else next.delete('bit')
        return next
      },
      { replace: true },
    )

  // Plan filtresi: gizlenen planlar (bu cihazda hatırlanır)
  const [hidden, setHiddenState] = useState(readHidden)
  const setHidden = (h: Set<string>) => {
    setHiddenState(h)
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...h]))
    } catch {
      /* depolama kapalı olabilir */
    }
  }

  const [view, setView] = useState<'tablo' | 'liste'>('tablo')
  const [dayModal, setDayModal] = useState<{ date: string; startNew?: boolean } | null>(null)

  const events = useMemo(() => Object.values(all).filter((e) => !e.deleted_at), [all])
  const visible = useMemo(() => events.filter((e) => !hidden.has(planKey(e.title))), [events, hidden])
  const byDay = useMemo(() => {
    const map = new Map<string, PlanEvent[]>()
    for (const ev of visible) {
      const list = map.get(ev.date) ?? []
      list.push(ev)
      map.set(ev.date, list)
    }
    for (const list of map.values()) list.sort(byTime)
    return map
  }, [visible])

  const openDay = (date: string, startNew?: boolean) => setDayModal({ date, startNew })
  const onDayClick = (d: string, shift: boolean) => {
    if (!wide && view === 'tablo') return openDay(d)
    if (shift && from) setRange(from, d)
    else setRange(d)
  }

  const showGrid = wide || view === 'tablo'
  const showPanel = wide || view === 'liste'

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
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:flex-none">
            <MonthNav month={focused} current={current} onChange={goMonth} />
            {!wide && (
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: 'tablo', label: 'Tablo' },
                  { value: 'liste', label: 'Liste' },
                ]}
              />
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {showGrid && (
          <ScrollGrid
            byDay={byDay}
            today={today}
            range={from ? range : null}
            focused={focused}
            onFocus={setFocused}
            target={scrollTarget}
            onDayClick={onDayClick}
            onDayDouble={(d) => openDay(d, true)}
          />
        )}
        {showPanel && (
          <PlanPanel
            events={events}
            visible={visible}
            range={range}
            explicit={!!from}
            focused={focused}
            today={today}
            hidden={hidden}
            onHidden={setHidden}
            onRange={setRange}
            onOpenDay={openDay}
            wide={wide}
          />
        )}
      </div>

      {dayModal && (
        <DayEvents
          date={dayModal.date}
          events={(byDay.get(dayModal.date) ?? []).concat(
            events.filter((e) => e.date === dayModal.date && hidden.has(planKey(e.title))),
          ).sort(byTime)}
          startNew={dayModal.startNew}
          onClose={() => setDayModal(null)}
        />
      )}
    </div>
  )
}

/** Gün adları başlığının yüksekliği (yapışkan; aya kaydırırken altında kalmasın) */
const HEAD_H = 30

/** Haftaların alt alta dizildiği, aylar arasında kesintisiz kaydırılan takvim. */
function ScrollGrid({
  byDay,
  today,
  range,
  focused,
  onFocus,
  target,
  onDayClick,
  onDayDouble,
}: {
  byDay: Map<string, PlanEvent[]>
  today: string
  range: string[] | null
  focused: string
  onFocus: (m: string) => void
  target: { month: string; n: number }
  onDayClick: (d: string, shift: boolean) => void
  onDayDouble: (d: string) => void
}) {
  const isDesktop = useIsDesktop()
  const box = useRef<HTMLDivElement>(null)
  const rows = useRef(new Map<string, HTMLDivElement>())
  const [span, setSpan] = useState(() => {
    const m = target.month
    return { start: startOfWeek(monthStart(addMonths(monthStart(m), -6).slice(0, 7))), end: addDays(startOfWeek(addMonths(monthStart(m), 13)), 6) }
  })
  // Satır yüksekliği: bir ayın en fazla 6 haftası pencereye tam sığsın
  const [rowH, setRowH] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setRowH(Math.max(isDesktop ? 72 : 56, Math.floor((el.clientHeight - HEAD_H - 8) / 6)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isDesktop])
  const weeks = useMemo(() => {
    const out: string[] = []
    for (let w = span.start; w <= span.end; w = addDays(w, 7)) out.push(w)
    return out
  }, [span])

  // Başa hafta eklenince içerik aşağı kaymasın
  const prevStart = useRef(span.start)
  const prevHeight = useRef(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    if (span.start < prevStart.current) el.scrollTop += el.scrollHeight - prevHeight.current
    prevStart.current = span.start
    prevHeight.current = el.scrollHeight
  }, [span])

  // İstenen aya kaydır (ilk açılış, oklar, "Bu ay")
  useLayoutEffect(() => {
    const el = box.current
    const first = startOfWeek(monthStart(target.month))
    if (first < span.start || first > span.end) {
      setSpan((s) => ({ start: first < s.start ? addDays(first, -7 * 26) : s.start, end: first > s.end ? addDays(first, 7 * 30 + 6) : s.end }))
      return
    }
    const row = rows.current.get(first)
    if (el && row) el.scrollTo({ top: row.offsetTop - HEAD_H, behavior: target.n ? 'smooth' : 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, weeks, rowH])

  const onScroll = () => {
    const el = box.current
    if (!el) return
    // Görünen ay: üstten üçte birlik yerdeki haftanın Perşembesi
    const line = el.scrollTop + el.clientHeight / 3
    for (const w of weeks) {
      const row = rows.current.get(w)
      if (row && row.offsetTop + row.offsetHeight >= line) {
        const m = monthOf(addDays(w, 3))
        if (m !== focused) onFocus(m)
        break
      }
    }
    if (el.scrollTop < 400) setSpan((s) => ({ ...s, start: addDays(s.start, -7 * 26) }))
    else if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) setSpan((s) => ({ ...s, end: addDays(s.end, 7 * 26) }))
  }

  // Hücreye sığan etkinlik sayısı (gün numarası ~26px, her satır ~18px)
  const max = Math.max(1, Math.floor((rowH - 30) / (isDesktop ? 20 : 16)))
  const inRange = (d: string) => !!range && d >= range[0] && d <= range[1]

  return (
    <div ref={box} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-4 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="sticky top-0 z-10 grid grid-cols-7 rounded-t-xl border border-line bg-surface-2 text-center text-xs font-medium text-muted">
          {WEEKDAYS_SHORT.map((w) => (
            <div key={w} className="flex items-center justify-center" style={{ height: HEAD_H }}>
              {w}
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-b-xl border-x border-b border-line">
          {weeks.map((w) => (
            <div
              key={w}
              ref={(el) => {
                if (el) rows.current.set(w, el)
                else rows.current.delete(w)
              }}
              className="grid grid-cols-7"
              style={rowH ? { height: rowH } : undefined}
            >
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(w, i)
                const m = monthOf(d)
                const day = Number(d.slice(8))
                const events = byDay.get(d) ?? []
                const fit = events.length > max ? max - 1 : max
                // Aylar dönüşümlü zeminle ayrılır; ayın ilk haftası üstte çizgiyle başlar
                const odd = Number(m.slice(5, 7)) % 2 === 1
                return (
                  <div
                    key={d}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => onDayClick(d, e.shiftKey)}
                    onDoubleClick={() => onDayDouble(d)}
                    onKeyDown={(e) => e.key === 'Enter' && onDayClick(d, e.shiftKey)}
                    aria-label={fmt(d, 'd MMMM EEEE')}
                    className={cx(
                      'flex min-h-0 min-w-0 select-none flex-col gap-0.5 overflow-hidden border-line p-1 transition-colors md:p-1.5',
                      i !== 6 && 'border-r',
                      'border-b',
                      day <= 7 && 'border-t-2 border-t-[color:var(--c-month)]',
                      inRange(d) ? 'bg-accent-soft' : odd ? 'bg-surface hover:bg-surface-2' : 'bg-surface-2/60 hover:bg-surface-2',
                      m !== focused && 'opacity-60',
                    )}
                    style={{ ['--c-month' as string]: PLAN_COLOR + '66' }}
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className={cx(
                          'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium',
                          d === today ? 'text-white' : 'text-ink',
                        )}
                        style={d === today ? { background: PLAN_COLOR } : undefined}
                      >
                        {day}
                      </span>
                      {day === 1 && (
                        <span className="truncate text-[10px] font-semibold uppercase md:text-xs" style={{ color: PLAN_COLOR }}>
                          {fmt(d, 'MMMM')}
                        </span>
                      )}
                    </span>
                    {events.slice(0, fit).map((ev) => (
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
                    {events.length > fit && <span className="px-1 text-[10px] leading-tight text-muted md:text-xs">+{events.length - fit}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Sağdaki pencere: tarih filtresi, plan filtresi ve seçilen aralığın etkinlikleri. */
function PlanPanel({
  events,
  visible,
  range,
  explicit,
  focused,
  today,
  hidden,
  onHidden,
  onRange,
  onOpenDay,
  wide,
}: {
  events: PlanEvent[]
  visible: PlanEvent[]
  range: string[]
  explicit: boolean
  focused: string
  today: string
  hidden: Set<string>
  onHidden: (h: Set<string>) => void
  onRange: (a: string | null, b?: string | null) => void
  onOpenDay: (d: string, startNew?: boolean) => void
  wide: boolean
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [full, setFull] = useState(false)
  const [query, setQuery] = useState('')
  const [a, b] = range

  const shown = useMemo(() => visible.filter((e) => e.date >= a && e.date <= b).sort((x, y) => x.date.localeCompare(y.date) || byTime(x, y)), [visible, a, b])
  const groups = useMemo(() => {
    const out: [string, PlanEvent[]][] = []
    for (const e of shown) {
      const last = out.at(-1)
      if (last && last[0] === e.date) last[1].push(e)
      else out.push([e.date, [e]])
    }
    return out
  }, [shown])

  // Plan filtresi: aralıktaki (ve gizli olan) planlar, adına göre gruplanmış
  const plans = useMemo(() => {
    const map = new Map<string, { title: string; count: number }>()
    for (const e of events) {
      const k = planKey(e.title)
      const inside = e.date >= a && e.date <= b
      if (!inside && !hidden.has(k)) continue
      const p = map.get(k) ?? { title: e.title.trim(), count: 0 }
      if (inside) p.count++
      map.set(k, p)
    }
    const q = query.trim().toLocaleLowerCase('tr')
    return [...map.entries()]
      .filter(([k]) => !q || k.includes(q))
      .sort((x, y) => y[1].count - x[1].count || x[1].title.localeCompare(y[1].title, 'tr'))
  }, [events, a, b, hidden, query])

  const hiddenCount = [...hidden].length
  const toggle = (k: string) => {
    const next = new Set(hidden)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    onHidden(next)
  }

  const label =
    a === b ? fmt(a, 'd MMMM EEEE') : monthOf(a) === monthOf(b) && a.endsWith('-01') && b === monthEnd(monthOf(a)) ? fmt(a, 'MMMM yyyy') : `${fmt(a, 'd MMM')} – ${fmt(b, 'd MMM')}`
  const weekStart = startOfWeek(today)
  const quick: [string, string, string][] = [
    ['Bugün', today, today],
    ['Bu hafta', weekStart, addDays(weekStart, 6)],
    ['Bu ay', monthStart(monthOf(today)), monthEnd(monthOf(today))],
    ['30 gün', today, addDays(today, 29)],
  ]

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-3 md:px-8 lg:w-96 lg:flex-none lg:border-l lg:border-line lg:px-4">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{label}</h2>
        <IconButton onClick={() => setFull(true)} aria-label="Tam ekranda görüntüle" title="Tam ekranda görüntüle" className="h-8 w-8">
          <Maximize2 className="h-4 w-4" />
        </IconButton>
      </div>

      {/* Tarih filtresi */}
      <div className="mt-2 rounded-lg border border-line">
        <button onClick={() => setDateOpen(!dateOpen)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
          <CalendarSearch className="h-4 w-4 text-muted" />
          <span className="flex-1">Tarihe göre filtrele</span>
          {explicit && <span className="rounded-full bg-accent-soft px-2 text-xs text-accent">Seçili</span>}
          <ChevronDown className={cx('h-4 w-4 text-muted transition-transform', dateOpen && 'rotate-180')} />
        </button>
        {dateOpen && (
          <div className="flex flex-col gap-2 border-t border-line p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {quick.map(([name, x, y]) => (
                <button
                  key={name}
                  onClick={() => onRange(x, y)}
                  className={cx(chipCls, explicit && a === x && b === y && 'border-accent bg-accent-soft text-accent')}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Başlangıç">
                <DateInput value={a} onChange={(v) => onRange(v, v > b ? v : b)} className={inputCls} aria-label="Başlangıç tarihi" />
              </Field>
              <Field label="Bitiş">
                <DateInput value={b} onChange={(v) => (v < a ? onRange(v, a) : onRange(a, v))} className={inputCls} aria-label="Bitiş tarihi" />
              </Field>
            </div>
            {explicit ? (
              <button onClick={() => onRange(null)} className="inline-flex items-center gap-1 self-start text-sm text-accent">
                <X className="h-4 w-4" /> Filtreyi temizle (görünen aya dön)
              </button>
            ) : (
              <p className="text-xs text-muted">
                Şu an görünen ay ({fmt(monthStart(focused), 'MMMM')}).{' '}
                {wide ? 'Takvimde bir güne tıkla, Shift ile tıklayarak aralık seç; çift tıkla etkinlik ekle.' : 'Hızlı seçimlerle ya da tarih alanlarıyla aralık seç.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Plan filtresi */}
      <div className="mt-2 rounded-lg border border-line">
        <button onClick={() => setFilterOpen(!filterOpen)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
          <Filter className="h-4 w-4 text-muted" />
          <span className="flex-1">Planları filtrele</span>
          {hiddenCount > 0 && <span className="rounded-full bg-accent-soft px-2 text-xs text-accent">{hiddenCount} gizli</span>}
          <ChevronDown className={cx('h-4 w-4 text-muted transition-transform', filterOpen && 'rotate-180')} />
        </button>
        {filterOpen && (
          <div className="flex flex-col gap-2 border-t border-line p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Plan ara" className={cx(inputCls, 'py-1.5 pl-9')} />
            </div>
            <div className="flex gap-2 text-sm">
              <button className="text-accent" onClick={() => onHidden(new Set())}>
                Tümünü göster
              </button>
              <span className="text-muted">·</span>
              <button className="text-accent" onClick={() => onHidden(new Set([...hidden, ...plans.map(([k]) => k)]))}>
                Hiçbirini gösterme
              </button>
            </div>
            {plans.length === 0 ? (
              <p className="text-sm text-muted">Bu aralıkta plan yok.</p>
            ) : (
              <div className="flex max-h-56 flex-col overflow-y-auto">
                {plans.map(([k, p]) => (
                  <label key={k} className="flex items-center gap-2 rounded px-1 py-1.5 text-[15px] hover:bg-surface-2">
                    <input type="checkbox" checked={!hidden.has(k)} onChange={() => toggle(k)} className="h-4 w-4 accent-accent" />
                    <span className={cx('min-w-0 flex-1 truncate', hidden.has(k) && 'text-muted')}>{p.title}</span>
                    <span className="text-xs text-muted">{p.count}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Etkinlikler */}
      <div className="mt-4 flex items-center gap-2">
        <span className="flex-1 text-sm text-muted">{shown.length ? `${shown.length} etkinlik` : 'Etkinlik yok'}</span>
        <button onClick={() => onOpenDay(a >= today || a === b ? a : today, true)} className="inline-flex items-center gap-1 text-sm font-medium text-accent">
          <Plus className="h-4 w-4" /> Etkinlik ekle
        </button>
      </div>
      <div className="mt-2">
        <EventGroups groups={groups} today={today} onOpenDay={onOpenDay} />
      </div>

      {full && (
        <FullEvents label={label} count={shown.length} onClose={() => setFull(false)} onAdd={() => onOpenDay(a >= today || a === b ? a : today, true)}>
          <EventGroups groups={groups} today={today} onOpenDay={onOpenDay} columns />
        </FullEvents>
      )}
    </section>
  )
}

/** Günlere göre gruplanmış etkinlik listesi (panelde ve tam ekranda). */
function EventGroups({
  groups,
  today,
  onOpenDay,
  columns,
}: {
  groups: [string, PlanEvent[]][]
  today: string
  onOpenDay: (d: string, startNew?: boolean) => void
  columns?: boolean
}) {
  return (
    <div className={columns ? 'gap-4 sm:columns-2 xl:columns-3 2xl:columns-4' : 'flex flex-col gap-3'}>
      {groups.map(([date, list]) => (
        <div key={date} className={cx('flex flex-col gap-1.5', columns && 'mb-4 break-inside-avoid')}>
          <div className="flex items-baseline gap-2 px-1 text-sm font-semibold">
            {fmt(date, 'd MMMM EEEE')}
            {/* Sadece "Bugün/Yarın/Dün" gibi kısa ifade; tarih zaten başlıkta */}
            {!/\d/.test(relativeDay(date, today)) && <span className="text-xs font-normal text-accent">{relativeDay(date, today)}</span>}
          </div>
          {list.map((ev) => (
            <button
              key={ev.id}
              onClick={() => onOpenDay(date)}
              className="flex w-full flex-col gap-0.5 rounded-lg border-l-[3px] bg-surface px-3 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-surface-2"
              style={{ borderLeftColor: PLAN_COLOR }}
            >
              <span className="break-words">
                {ev.time && <span className="mr-1.5 font-medium" style={{ color: PLAN_COLOR }}>{ev.time}</span>}
                {ev.title}
              </span>
              {ev.location && (
                <span className="flex items-center gap-1 text-sm text-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {ev.location}
                </span>
              )}
              {ev.note && <span className={cx('whitespace-pre-wrap text-sm text-muted', !columns && 'line-clamp-2')}>{ev.note}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Seçilen aralığın etkinliklerini tüm ekranı kaplayan görünümde gösterir. Gün penceresi (Modal, z-40) bunun üstünde açılır. */
function FullEvents({
  label,
  count,
  onClose,
  onAdd,
  children,
}: {
  label: string
  count: number
  onClose: () => void
  onAdd: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Üstte bir pencere açıksa Esc önce onu kapatsın
      if (e.key === 'Escape' && !document.querySelector('.z-40, .z-50')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg" role="dialog" aria-label={label + ' etkinlikleri'}>
      <header className="pt-safe shrink-0 border-b border-line px-4 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-2 py-3">
          <CalendarRange className="h-6 w-6 shrink-0" style={{ color: PLAN_COLOR }} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold tracking-tight md:text-2xl">{label}</h2>
            <div className="text-sm text-muted">{count ? count + ' etkinlik' : 'Etkinlik yok'}</div>
          </div>
          <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-surface-2">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Etkinlik ekle</span>
          </button>
          <IconButton onClick={onClose} aria-label="Tam ekrandan çık" title="Tam ekrandan çık">
            <Minimize2 className="h-5 w-5" />
          </IconButton>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
        <div className="mx-auto max-w-7xl pb-8">
          {count ? children : <div className="py-16 text-center text-muted">Bu aralıkta etkinlik yok.</div>}
        </div>
      </div>
    </div>
  )
}

/** Bir günün etkinlikleri: listele, ekle, düzenle, sil. */
function DayEvents({ date, events, startNew, onClose }: { date: string; events: PlanEvent[]; startNew?: boolean; onClose: () => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(startNew || !events.length ? 'new' : null)

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
          <DateInput value={day} onChange={setDay} className={inputCls} />
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
