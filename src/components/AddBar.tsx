import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Bell, CalendarDays, CheckCircle2, Clock, Plus, Repeat, X } from 'lucide-react'
import { addDays, type Weekday } from '@shared/schedule.ts'
import { createItem, defaultTime, todayStr, type NewItem } from '../lib/store'
import { fmt, recurrenceLabel, relativeDay, startOfWeek, WEEKDAYS_SHORT } from '../lib/dates'
import type { Recurrence } from '../lib/types'
import { useUi } from '../lib/ui'
import { cx } from './ui'

type Menu = 'date' | 'repeat' | null

/** Microsoft To Do tarzı ekleme kutusu: "+ Görev ekle" satırına dokununca açılır,
 *  altında tür / tarih / saat / tekrar çipleri çıkar. Saat varsayılan saatle dolu gelir;
 *  kullanıcı değiştirirse öğe "saati elle girilmiş" olarak kaydedilir. */
export default function AddBar({ defaults, placeholder = 'Görev ekle' }: { defaults: Partial<NewItem>; placeholder?: string }) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'task' | 'reminder'>('task')
  const [date, setDate] = useState(defaults.due_date ?? '')
  const [time, setTime] = useState(defaultTime)
  const [timeTouched, setTimeTouched] = useState(false)
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    useUi.setState({ adding: open })
    return () => useUi.setState({ adding: false })
  }, [open])
  const [menu, setMenu] = useState<Menu>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const today = todayStr()

  // Kutunun dışına dokununca (yazı yoksa) kapan
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (formRef.current?.contains(e.target as Node)) return
      setMenu(null)
      if (!inputRef.current?.value.trim()) {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Kutu açılırken yukarı doğru büyür; açan dokunuş yeni beliren bir düğmeye "tıklamış" sayılmasın
  const openedAt = useRef(0)
  const guard = (fn: () => void) => () => {
    if (Date.now() - openedAt.current > 350) fn()
  }

  const reset = () => {
    setKind('task')
    setTitle('')
    setDate(defaults.due_date ?? '')
    setTime(defaultTime())
    setTimeTouched(false)
    setRecurrence(null)
    setMenu(null)
  }

  const submit = () => {
    const t = title.trim()
    if (!t) return
    createItem({
      ...defaults,
      title: t,
      kind,
      due_date: date || null,
      due_time: date ? time : null,
      time_explicit: !!date && timeTouched,
      recurrence: date ? recurrence : null,
    })
    reset()
    // Ekledikten sonra kutuyu kapat, klavyeyi indir; liste görünsün
    setOpen(false)
    inputRef.current?.blur()
  }

  const pickDate = (d: string) => {
    setDate(d)
    setMenu(null)
  }

  const repeatPresets: [string, Recurrence][] = [
    ['Her gün', { freq: 'daily', interval: 1 }],
    ['Hafta içi her gün', { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }],
    ['Her ay', { freq: 'monthly', interval: 1 }],
    ['Her yıl', { freq: 'yearly', interval: 1 }],
  ]
  const weeklyDays = recurrence?.freq === 'weekly' ? (recurrence.byWeekday ?? []) : []
  const toggleWeekday = (wd: Weekday) => {
    const days = weeklyDays.includes(wd) ? weeklyDays.filter((d) => d !== wd) : [...weeklyDays, wd]
    setRecurrence(days.length ? { freq: 'weekly', interval: 1, byWeekday: days } : null)
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className={cx('relative rounded-xl bg-surface', open ? 'shadow-[0_2px_10px_rgba(0,0,0,0.12)]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.08)]')}
    >
      <div className={cx('flex items-center gap-3 px-3', open ? 'pb-1 pt-2.5' : 'py-2.5')}>
        {open ? (
          kind === 'task' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
          ) : (
            <Bell className="h-5 w-5 shrink-0 text-accent" />
          )
        ) : (
          <Plus className="h-5 w-5 shrink-0 text-accent" />
        )}
        <input
          ref={inputRef}
          onFocus={() => {
            if (!open) openedAt.current = Date.now()
            setOpen(true)
          }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // Klavyedeki enter/return tuşu görevi ekler
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={kind === 'task' ? placeholder : 'Hatırlatma ekle'}
          className={cx('min-w-0 flex-1 bg-transparent py-1 text-base outline-none', open ? 'placeholder:text-muted' : 'placeholder:text-accent')}
          enterKeyHint="enter"
          autoCapitalize="sentences"
        />
        {open && (
        <button
          type="submit"
          onMouseDown={keepFocus}
          aria-label="Ekle"
          disabled={!title.trim()}
          className={cx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
            title.trim() ? 'bg-accent text-white' : 'bg-surface-2 text-muted',
          )}
        >
          <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.5} />
        </button>
        )}
      </div>

      {open && (
      <>
      {/* Tür seçimi: iki ayrı, açıkça görünen seçenek */}
      <div className="mx-3 mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ['task', CheckCircle2, 'Görev'],
            ['reminder', Bell, 'Hatırlatma'],
          ] as const
        ).map(([k, Icon, label]) => (
          <button
            key={k}
            type="button"
            onMouseDown={keepFocus}
            onClick={guard(() => setKind(k))}
            className={cx(
              'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
              kind === k ? 'bg-accent text-white shadow-sm' : 'text-muted',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <p className="px-4 pt-1 text-xs text-muted">
        {kind === 'task' ? 'Yapınca tiklenir.' : 'Tiklenmez, sadece bildirim gelir.'}
      </p>
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 pb-2.5 pt-2">

        <Chip active={!!date} onClick={guard(() => setMenu(menu === 'date' ? null : 'date'))}>
          <CalendarDays className="h-4 w-4" />
          {date ? relativeDay(date, today) : 'Tarih'}
          {date && !defaults.due_date && (
            <ClearX
              onClear={() => {
                setDate('')
                setRecurrence(null)
              }}
            />
          )}
        </Chip>

        {date && (
          <label
            className={cx(
              'relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
              timeTouched ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted',
            )}
          >
            <Clock className="h-4 w-4" />
            {time}
            {/* Şeffaf saat alanı: dokununca iPhone'un saat seçicisi açılır */}
            <input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value || defaultTime())
                setTimeTouched(true)
              }}
              className="absolute inset-0 opacity-0"
              aria-label="Saat"
            />
          </label>
        )}

        {date && (
          <Chip active={!!recurrence} onClick={guard(() => setMenu(menu === 'repeat' ? null : 'repeat'))}>
            <Repeat className="h-4 w-4" />
            {recurrence ? recurrenceLabel(recurrence) : 'Tekrar'}
            {recurrence && <ClearX onClear={() => setRecurrence(null)} />}
          </Chip>
        )}
      </div>
      </>
      )}

      {menu === 'date' && (
        <MenuBox>
          <MenuItem onClick={() => pickDate(today)} hint={fmt(today, 'EEE')}>
            Bugün
          </MenuItem>
          <MenuItem onClick={() => pickDate(addDays(today, 1))} hint={fmt(addDays(today, 1), 'EEE')}>
            Yarın
          </MenuItem>
          <MenuItem
            onClick={() => pickDate(addDays(startOfWeek(today), 7))}
            hint={fmt(addDays(startOfWeek(today), 7), 'EEE, d MMM')}
          >
            Gelecek hafta
          </MenuItem>
          <label className="relative flex items-center justify-between px-4 py-3 text-[15px] active:bg-surface-2">
            Tarih seç…
            <CalendarDays className="h-4 w-4 text-muted" />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && pickDate(e.target.value)}
              className="absolute inset-0 opacity-0"
              aria-label="Tarih seç"
            />
          </label>
        </MenuBox>
      )}

      {menu === 'repeat' && (
        <MenuBox>
          {repeatPresets.map(([label, r]) => (
            <MenuItem
              key={label}
              onClick={() => {
                setRecurrence(r)
                setMenu(null)
              }}
            >
              {label}
            </MenuItem>
          ))}
          <div className="px-4 py-3">
            <div className="mb-2 text-[15px]">Her hafta şu günlerde</div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS_SHORT.map((label, i) => {
                const wd = ((i + 1) % 7) as Weekday
                const on = weeklyDays.includes(wd)
                return (
                  <button
                    key={label}
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => toggleWeekday(wd)}
                    className={cx(
                      'rounded-lg py-2 text-xs font-medium transition-colors',
                      on ? 'bg-accent text-white' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {/* Hep görünür: sonradan belirip menüyü kaydırmasın */}
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => setMenu(null)}
              disabled={!weeklyDays.length}
              className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Tamam
            </button>
          </div>
        </MenuBox>
      )}
    </form>
  )
}

/** Düğmeye basınca yazı alanı odağı kaybetmesin; klavye açık kalsın */
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onClick}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted',
      )}
    >
      {children}
    </button>
  )
}

function ClearX({ onClear }: { onClear: () => void }) {
  return (
    <span
      role="button"
      aria-label="Kaldır"
      onClick={(e) => {
        e.stopPropagation()
        onClear()
      }}
      className="-mr-1 ml-0.5 rounded-full p-0.5"
    >
      <X className="h-3.5 w-3.5" />
    </span>
  )
}

function MenuBox({ children }: { children: ReactNode }) {
  return (
    <div className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-xl border border-line bg-surface shadow-lg sm:right-auto sm:w-64">
      <div className="divide-y divide-line">{children}</div>
    </div>
  )
}

function MenuItem({ onClick, hint, children }: { onClick: () => void; hint?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onClick}
      className="flex w-full items-center justify-between px-4 py-3 text-left text-[15px] active:bg-surface-2"
    >
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </button>
  )
}
