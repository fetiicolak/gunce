import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Logo({ className }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Günce" className={className} />
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')

export function Checkbox({
  checked,
  onChange,
  color,
  disabled,
  size = 22,
}: {
  checked: boolean
  onChange: () => void
  color: string
  disabled?: boolean
  size?: number
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cx(
        'group flex shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        disabled && 'opacity-40',
      )}
      style={{ width: size, height: size, borderColor: color, background: checked ? color : 'transparent' }}
    >
      <Check
        strokeWidth={3}
        className={cx('h-3 w-3 transition-opacity', checked ? 'text-white opacity-100' : 'opacity-0 group-hover:opacity-60')}
        style={checked ? undefined : { color }}
      />
    </button>
  )
}

export function IconButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink active:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cx('inline-flex rounded-lg bg-surface-2 p-0.5 text-sm', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md px-3 py-1 font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-1.5 text-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
        {children}
      </div>
    </div>
  )
}

export const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none transition-colors focus:border-accent'

export const chipCls =
  'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink transition-colors hover:border-accent'

/** Seçicinin ve klavyeyle yazmanın başladığı en erken yıl (seçici 0001'den açılmasın) */
export const MIN_DATE = '2026-01-01'
export const MAX_DATE = '2100-12-31'

/** Tarih alanı: klavyeyle yazarken yıl tamamlanmadan ("0002-…") değeri dışarı vermez.
 *  Geçerli tarih (MIN_DATE–MAX_DATE) oluşunca `onChange` çağrılır; yarım kalırsa alandan çıkınca eski değere döner. */
export function DateInput({
  value,
  onChange,
  min = MIN_DATE,
  max = MAX_DATE,
  className,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
  className?: string
  'aria-label'?: string
}) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  // Dışarıdan değişince (hızlı seçim, takvime tıklama) alanı güncelle; yazarken dokunma
  useEffect(() => {
    if (!focused) setDraft(value)
  }, [value, focused])
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= min && v <= max
  // Yazarken ara değerler (ay "1" → Ocak) hemen uygulanmasın: son tuştan kısa süre sonra ya da alandan çıkınca uygula
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const commit = (v: string) => {
    clearTimeout(timer.current)
    if (valid(v) && v !== value) onChange(v)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <input
      type="date"
      value={draft}
      min={min}
      max={max}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        if (valid(draft)) commit(draft)
        else setDraft(value)
      }}
      onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
      onChange={(e) => {
        const v = e.target.value
        setDraft(v)
        clearTimeout(timer.current)
        // Seçiciden seçim (odak yokken) hemen; klavyeyle yazarken 800 ms sonra
        if (!focused) commit(v)
        else if (valid(v)) timer.current = setTimeout(() => commit(v), 800)
      }}
      className={className}
      {...rest}
    />
  )
}
