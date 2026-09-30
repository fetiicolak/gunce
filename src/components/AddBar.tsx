import { useRef, useState } from 'react'
import { ArrowUp, Bell, CalendarDays, CheckCircle2, Clock, Plus, X } from 'lucide-react'
import { createItem, defaultTime, todayStr, type NewItem } from '../lib/store'
import { cx } from './ui'

/** Liste altındaki hızlı ekleme çubuğu. Saat alanı varsayılan saatle dolu gelir;
 *  kullanıcı değiştirirse öğe "saati elle girilmiş" olarak kaydedilir. */
export default function AddBar({ defaults, placeholder = 'Görev ekle' }: { defaults: Partial<NewItem>; placeholder?: string }) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'task' | 'reminder'>('task')
  const [date, setDate] = useState(defaults.due_date ?? '')
  const [time, setTime] = useState(defaultTime)
  const [timeTouched, setTimeTouched] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const expanded = focused || title.length > 0

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
    })
    setTitle('')
    setTimeTouched(false)
    setTime(defaultTime())
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false)
      }}
      className="rounded-xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="submit" className="text-accent" aria-label="Ekle">
          <Plus className="h-5 w-5" />
        </button>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'task' ? placeholder : 'Hatırlatma ekle'}
          onKeyDown={(e) => {
            // Klavyedeki Enter/return tuşu görevi ekler (iOS dahil)
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-accent"
          enterKeyHint="enter"
          autoCapitalize="sentences"
        />
        {title.trim() && (
          <button
            type="submit"
            aria-label="Ekle"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white"
          >
            <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2 text-sm">
          <div className="inline-flex rounded-lg bg-surface-2 p-0.5">
            {(
              [
                ['task', CheckCircle2, 'Görev'],
                ['reminder', Bell, 'Hatırlatma'],
              ] as const
            ).map(([k, Icon, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cx(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1',
                  kind === k ? 'bg-surface text-ink shadow-sm' : 'text-muted',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <label className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1', date ? 'bg-accent-soft text-accent' : 'text-muted')}>
            <CalendarDays className="h-3.5 w-3.5" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[8.5rem] bg-transparent text-sm outline-none"
            />
            {date && !defaults.due_date && (
              <button type="button" onClick={() => setDate('')} aria-label="Tarihi kaldır">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          {!date && (
            <button type="button" onClick={() => setDate(todayStr())} className="rounded-lg px-2 py-1 text-muted hover:text-ink">
              Bugün
            </button>
          )}

          <label
            className={cx(
              'inline-flex items-center gap-1 rounded-lg px-2 py-1',
              timeTouched ? 'bg-accent-soft text-accent' : 'text-muted',
              !date && 'opacity-50',
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value || defaultTime())
                setTimeTouched(true)
                if (!date) setDate(defaults.due_date ?? todayStr())
              }}
              className="bg-transparent text-sm outline-none"
            />
          </label>
        </div>
      )}
    </form>
  )
}
