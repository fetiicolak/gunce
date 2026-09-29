import { useEffect, useState } from 'react'
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  List as ListIcon,
  Plus,
  Repeat,
  StickyNote,
  Star,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { addDays, mondayIndex, weekday, zonedParts, type Weekday } from '@shared/schedule.ts'
import { defaultTime, deleteItem, toggleComplete, updateItem, useStore, uuid } from '../lib/store'
import { isDone, overdue, useLists, useSettings } from '../lib/selectors'
import { useOpenItem } from '../lib/nav'
import { useToday } from '../lib/useToday'
import { fmt, recurrenceLabel, reminderLabel, startOfWeek, WEEKDAYS_SHORT } from '../lib/dates'
import { LIST_COLORS, type Item, type Recurrence, type Reminder } from '../lib/types'
import { Checkbox, chipCls, cx, Field, IconButton, inputCls, Segmented, useIsDesktop } from './ui'

export default function ItemDetail({ id }: { id: string }) {
  const item = useStore((s) => s.items[id])
  const ready = useStore((s) => s.ready)
  const open = useOpenItem()
  const isDesktop = useIsDesktop()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!item || item.deleted_at) {
    if (ready) queueMicrotask(() => open(null))
    return null
  }

  return (
    <>
      {isDesktop ? null : <div className="fixed inset-0 z-30 bg-black/30" onClick={() => open(null)} />}
      <aside
        className={cx(
          'flex flex-col bg-bg',
          isDesktop ? 'w-[380px] shrink-0 border-l border-line' : 'pt-safe fixed inset-0 z-40',
        )}
      >
        <Detail item={item} onClose={() => open(null)} isDesktop={isDesktop} />
      </aside>
    </>
  )
}

function Detail({ item, onClose, isDesktop }: { item: Item; onClose: () => void; isDesktop: boolean }) {
  const today = useToday()
  const settings = useSettings()
  const lists = useLists()
  const list = useStore((s) => s.lists[item.list_id])
  const color = LIST_COLORS[list?.color ?? 'blue']
  const done = isDone(item, today)
  const late = overdue(item, settings)
  const set = (patch: Partial<Item>) => updateItem(item.id, patch)

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 px-2 py-2">
        <IconButton onClick={onClose} aria-label="Kapat">
          {isDesktop ? <X className="h-5 w-5" /> : <ChevronLeft className="h-6 w-6" />}
        </IconButton>
        <span className="flex-1 truncate text-sm text-muted">{list?.name}</span>
        <IconButton
          aria-label="Sil"
          className="hover:text-danger"
          onClick={() => {
            if (confirm(`"${item.title}" silinsin mi?`)) {
              deleteItem(item.id)
              onClose()
            }
          }}
        >
          <Trash2 className="h-4.5 w-4.5" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
        {/* Başlık */}
        <div className="rounded-xl bg-surface">
          <div className="flex items-start gap-3 px-4 pb-2 pt-4">
            <div className="pt-1">
              {item.kind === 'task' ? (
                <Checkbox checked={done} onChange={() => toggleComplete(item.id)} color={color} size={24} />
              ) : (
                <Bell className="h-6 w-6" style={{ color }} />
              )}
            </div>
            <TitleInput item={item} done={done} />
            <button onClick={() => set({ important: !item.important })} className="pt-1" aria-label="Önemli">
              <Star className={cx('h-5 w-5', item.important ? 'fill-star text-star' : 'text-muted')} />
            </button>
          </div>
          <div className="px-4 pb-3">
            <Segmented
              value={item.kind}
              onChange={(kind) => set({ kind })}
              options={[
                {
                  value: 'task',
                  label: (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Görev
                    </span>
                  ),
                },
                {
                  value: 'reminder',
                  label: (
                    <span className="inline-flex items-center gap-1">
                      <Bell className="h-3.5 w-3.5" /> Hatırlatma
                    </span>
                  ),
                },
              ]}
            />
            {item.kind === 'reminder' && (
              <p className="mt-2 text-xs text-muted">Hatırlatmalar tiklenmez; sadece bilgilendirme için bildirim gelir.</p>
            )}
          </div>
          {item.kind === 'task' && <Steps item={item} color={color} />}
        </div>

        {/* Günüm */}
        <button
          onClick={() => set({ my_day: item.my_day === today ? null : today })}
          className={cx(
            'mt-2 flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3 text-left',
            item.my_day === today ? 'text-accent' : 'text-ink',
          )}
        >
          <Sun className="h-5 w-5" />
          <span className="flex-1">{item.my_day === today ? 'Günüm listesine eklendi' : 'Günüme ekle'}</span>
          {item.my_day === today && <X className="h-4 w-4 text-muted" />}
        </button>

        {/* Zamanlama */}
        <div className="mt-2 divide-y divide-line rounded-xl bg-surface">
          <Field icon={<CalendarDays className="h-5 w-5" />} label="Tarih">
            <DateEditor item={item} late={late} />
          </Field>
          {item.due_date && (
            <Field icon={<Clock className="h-5 w-5" />} label="Saat">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={item.due_time ?? defaultTime()}
                  onChange={(e) => set({ due_time: e.target.value || defaultTime(), time_explicit: true })}
                  className={cx(inputCls, 'w-32')}
                />
                {item.time_explicit ? (
                  <button onClick={() => set({ due_time: defaultTime(), time_explicit: false })} className="text-sm text-accent">
                    Varsayılana dön
                  </button>
                ) : (
                  <span className="text-xs text-muted">Varsayılan · sabah özetinde gelir</span>
                )}
              </div>
            </Field>
          )}
          {item.due_date && (
            <Field icon={<Repeat className="h-5 w-5" />} label="Tekrarla">
              <RecurrenceEditor item={item} />
            </Field>
          )}
          <Field icon={<Bell className="h-5 w-5" />} label="Hatırlatmalar">
            <RemindersEditor item={item} />
          </Field>
        </div>

        {/* Liste ve not */}
        <div className="mt-2 divide-y divide-line rounded-xl bg-surface">
          <Field icon={<ListIcon className="h-5 w-5" />} label="Liste">
            <select value={item.list_id} onChange={(e) => set({ list_id: e.target.value })} className={inputCls}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field icon={<StickyNote className="h-5 w-5" />} label="Not">
            <textarea
              value={item.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Not ekle"
              rows={4}
              className={cx(inputCls, 'resize-y')}
            />
          </Field>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          {item.completed_at
            ? `${fmt(zonedParts(Date.parse(item.completed_at), settings.timezone).date, 'd MMMM yyyy')} tarihinde tamamlandı`
            : `${fmt(zonedParts(Date.parse(item.created_at), settings.timezone).date, 'd MMMM yyyy')} tarihinde oluşturuldu`}
        </p>
      </div>
    </>
  )
}

function TitleInput({ item, done }: { item: Item; done: boolean }) {
  const [value, setValue] = useState(item.title)
  useEffect(() => setValue(item.title), [item.id, item.title])
  const commit = () => {
    const v = value.trim()
    if (v && v !== item.title) updateItem(item.id, { title: v })
    else setValue(item.title)
  }
  return (
    <textarea
      value={value}
      rows={1}
      onChange={(e) => setValue(e.target.value.replace(/\n/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className={cx(
        'field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-lg font-semibold outline-none',
        done && 'text-muted line-through',
      )}
    />
  )
}

function Steps({ item, color }: { item: Item; color: string }) {
  const [draft, setDraft] = useState('')
  const setSteps = (steps: Item['steps']) => updateItem(item.id, { steps })
  return (
    <div className="border-t border-line px-4 py-2">
      {item.steps.map((s) => (
        <div key={s.id} className="group flex items-center gap-3 py-1.5">
          <Checkbox
            size={18}
            color={color}
            checked={s.done}
            onChange={() => setSteps(item.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
          />
          <input
            value={s.title}
            onChange={(e) => setSteps(item.steps.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
            className={cx('min-w-0 flex-1 bg-transparent text-[15px] outline-none', s.done && 'text-muted line-through')}
          />
          <button
            onClick={() => setSteps(item.steps.filter((x) => x.id !== s.id))}
            className="text-muted opacity-60 hover:text-danger md:opacity-0 md:group-hover:opacity-100"
            aria-label="Adımı sil"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <form
        className="flex items-center gap-3 py-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          const t = draft.trim()
          if (!t) return
          setSteps([...item.steps, { id: uuid(), title: t, done: false }])
          setDraft('')
        }}
      >
        <Plus className="h-[18px] w-[18px] text-accent" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={item.steps.length ? 'Sonraki adım' : 'Adım ekle'}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-accent"
        />
      </form>
    </div>
  )
}

function DateEditor({ item, late }: { item: Item; late: boolean }) {
  const today = useToday()
  const set = (due_date: string | null) => updateItem(item.id, { due_date })
  const nextMonday = addDays(startOfWeek(today), 7)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={item.due_date ?? ''}
          onChange={(e) => set(e.target.value || null)}
          className={cx(inputCls, 'w-44', late && 'border-danger text-danger')}
        />
        {item.due_date && (
          <IconButton onClick={() => set(null)} aria-label="Tarihi kaldır">
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>
      {late && <span className="text-xs font-medium text-danger">Gecikmiş</span>}
      <div className="flex flex-wrap gap-1.5">
        <button className={chipCls} onClick={() => set(today)}>
          Bugün
        </button>
        <button className={chipCls} onClick={() => set(addDays(today, 1))}>
          Yarın
        </button>
        <button className={chipCls} onClick={() => set(nextMonday)}>
          Gelecek hafta
        </button>
      </div>
    </div>
  )
}

type Preset = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom'

function presetOf(r: Recurrence | null): Preset {
  if (!r) return 'none'
  if (r.interval > 1) return 'custom'
  if (r.freq === 'weekly') {
    const d = [...(r.byWeekday ?? [])].sort().join()
    if (d === '1,2,3,4,5') return 'weekdays'
    return (r.byWeekday?.length ?? 0) <= 1 ? 'weekly' : 'custom'
  }
  return r.freq
}

function RecurrenceEditor({ item }: { item: Item }) {
  const r = item.recurrence
  const [custom, setCustom] = useState(presetOf(r) === 'custom')
  const set = (recurrence: Recurrence | null) => updateItem(item.id, { recurrence })
  const dow = weekday(item.due_date!)

  const choose = (p: Preset) => {
    setCustom(p === 'custom')
    const until = r?.until ?? null
    switch (p) {
      case 'none':
        return set(null)
      case 'daily':
        return set({ freq: 'daily', interval: 1, until })
      case 'weekdays':
        return set({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5], until })
      case 'weekly':
        return set({ freq: 'weekly', interval: 1, byWeekday: [dow], until })
      case 'monthly':
        return set({ freq: 'monthly', interval: 1, until })
      case 'yearly':
        return set({ freq: 'yearly', interval: 1, until })
      case 'custom':
        return set(r ?? { freq: 'weekly', interval: 1, byWeekday: [dow], until })
    }
  }

  const unit = { daily: 'günde', weekly: 'haftada', monthly: 'ayda', yearly: 'yılda' }

  return (
    <div className="flex flex-col gap-2">
      <select value={custom ? 'custom' : presetOf(r)} onChange={(e) => choose(e.target.value as Preset)} className={inputCls}>
        <option value="none">Tekrar yok</option>
        <option value="daily">Her gün</option>
        <option value="weekdays">Hafta içi her gün</option>
        <option value="weekly">Her hafta ({WEEKDAYS_SHORT[mondayIndex(dow)]})</option>
        <option value="monthly">Her ay (ayın {Number(item.due_date!.slice(8))}'i)</option>
        <option value="yearly">Her yıl</option>
        <option value="custom">Özel…</option>
      </select>
      {r && custom && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-2">
          <div className="flex items-center gap-2 text-sm">
            <input
              type="number"
              min={1}
              value={r.interval}
              onChange={(e) => set({ ...r, interval: Math.max(1, Number(e.target.value) || 1) })}
              className={cx(inputCls, 'w-16')}
            />
            <select
              value={r.freq}
              onChange={(e) => {
                const freq = e.target.value as Recurrence['freq']
                set({ ...r, freq, byWeekday: freq === 'weekly' ? (r.byWeekday?.length ? r.byWeekday : [dow]) : undefined })
              }}
              className={cx(inputCls, 'w-auto')}
            >
              {(Object.keys(unit) as Recurrence['freq'][]).map((f) => (
                <option key={f} value={f}>
                  {unit[f]} bir
                </option>
              ))}
            </select>
          </div>
          {r.freq === 'weekly' && (
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS_SHORT.map((label, i) => {
                const wd = ((i + 1) % 7) as Weekday
                const on = r.byWeekday?.includes(wd)
                return (
                  <button
                    key={label}
                    onClick={() => {
                      const days = on ? r.byWeekday!.filter((d) => d !== wd) : [...(r.byWeekday ?? []), wd]
                      if (days.length) set({ ...r, byWeekday: days })
                    }}
                    className={cx(
                      'h-8 w-10 rounded-md text-sm font-medium',
                      on ? 'bg-accent text-white' : 'bg-surface text-muted',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {r && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>Bitiş:</span>
          <input
            type="date"
            value={r.until ?? ''}
            min={item.due_date!}
            onChange={(e) => set({ ...r, until: e.target.value || null })}
            className={cx(inputCls, 'w-44 py-1')}
          />
          {r.until && (
            <button onClick={() => set({ ...r, until: null })} aria-label="Bitişi kaldır">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {r && <span className="text-xs text-muted">{recurrenceLabel(r)}</span>}
    </div>
  )
}

const OFFSETS: [number, string][] = [
  [0, 'Tam zamanında'],
  [5, '5 dk önce'],
  [15, '15 dk önce'],
  [30, '30 dk önce'],
  [60, '1 saat önce'],
  [120, '2 saat önce'],
  [1440, '1 gün önce'],
  [2880, '2 gün önce'],
  [10080, '1 hafta önce'],
]

function RemindersEditor({ item }: { item: Item }) {
  const [adding, setAdding] = useState<'menu' | 'custom' | null>(null)
  const [custom, setCustom] = useState('')
  const today = useToday()
  const set = (reminders: Reminder[]) => updateItem(item.id, { reminders })
  const sorted = [...item.reminders].sort((a, b) =>
    a.type === 'offset' && b.type === 'offset' ? a.minutes - b.minutes : a.type === 'offset' ? -1 : 1,
  )
  const used = new Set(item.reminders.flatMap((r) => (r.type === 'offset' ? [r.minutes] : [])))

  return (
    <div className="flex flex-col gap-2">
      {sorted.length === 0 && (
        <span className="text-sm text-muted">{item.due_date ? 'Bildirim gelmeyecek' : 'Tarih ekleyince bildirim ayarlanır'}</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((r) => (
          <span key={r.id} className={cx(chipCls, 'bg-accent-soft pr-1.5')}>
            {reminderLabel(r)}
            <button onClick={() => set(item.reminders.filter((x) => x.id !== r.id))} aria-label="Kaldır" className="text-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      {adding === null && (
        <button onClick={() => setAdding(item.due_date ? 'menu' : 'custom')} className="inline-flex w-fit items-center gap-1 text-sm text-accent">
          <Plus className="h-4 w-4" /> Hatırlatma ekle
        </button>
      )}
      {adding === 'menu' && (
        <div className="flex flex-wrap gap-1.5">
          {OFFSETS.filter(([m]) => !used.has(m)).map(([m, label]) => (
            <button
              key={m}
              className={chipCls}
              onClick={() => {
                set([...item.reminders, { id: uuid(), type: 'offset', minutes: m }])
                setAdding(null)
              }}
            >
              {label}
            </button>
          ))}
          <button className={chipCls} onClick={() => setAdding('custom')}>
            Özel tarih/saat…
          </button>
          <button className="px-2 text-sm text-muted" onClick={() => setAdding(null)}>
            Vazgeç
          </button>
        </div>
      )}
      {adding === 'custom' && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!custom) return
            set([...item.reminders, { id: uuid(), type: 'absolute', at: custom.slice(0, 16) }])
            setCustom('')
            setAdding(null)
          }}
        >
          <input
            type="datetime-local"
            value={custom}
            min={`${today}T00:00`}
            onChange={(e) => setCustom(e.target.value)}
            className={cx(inputCls, 'w-auto')}
          />
          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
            Ekle
          </button>
          <button type="button" className="text-sm text-muted" onClick={() => setAdding(null)}>
            Vazgeç
          </button>
        </form>
      )}
    </div>
  )
}
