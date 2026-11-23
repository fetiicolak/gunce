import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Plus, Repeat, Wallet } from 'lucide-react'
import { monthOf, sameDayIn } from '@shared/plans.ts'
import { askConfirm } from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import MonthNav from '../components/MonthNav'
import { Checkbox, cx, IconButton, inputCls, useIsDesktop } from '../components/ui'
import { fmt } from '../lib/dates'
import { playDone } from '../lib/sound'
import { createExpense, deleteExpense, ensureRecurringExpenses, updateExpense, useStore } from '../lib/store'
import type { Expense } from '../lib/types'
import { useToday } from '../lib/useToday'

export const EXPENSES_COLOR = '#0f8f6a'

const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
export const formatMoney = (n: number) => money.format(n)

/** "1.500,50", "1500,5", "1500.50", "1500" → sayı; geçersizse NaN */
export function parseAmount(text: string): number {
  let t = text.replace(/[^\d.,]/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '')
  return t ? Number(t) : NaN
}

export default function ExpensesPage() {
  const today = useToday()
  const current = monthOf(today)
  const [params, setParams] = useSearchParams()
  const month = params.get('ay') ?? current
  const setMonth = (m: string) => setParams(m === current ? {} : { ay: m }, { replace: true })
  const ready = useStore((s) => s.ready)
  const all = useStore((s) => s.expenses)
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)

  // "Her ay tekrarla" harcamalarının bu aydaki kopyalarını oluştur
  useEffect(() => {
    if (ready && month >= current) ensureRecurringExpenses(month)
  }, [ready, month, current, all])

  const rows = useMemo(
    () =>
      Object.values(all)
        .filter((e) => !e.deleted_at && monthOf(e.due_date) === month)
        .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title, 'tr')),
    [all, month],
  )
  const total = rows.reduce((n, e) => n + e.amount, 0)
  const paid = rows.filter((e) => e.paid_on).reduce((n, e) => n + e.amount, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 px-4 md:px-8">
        <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-8">
          <div className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-auto" style={{ color: EXPENSES_COLOR }}>
            {!isDesktop && (
              <IconButton onClick={() => navigate('/listeler')} className="-ml-2" aria-label="Geri" style={{ color: EXPENSES_COLOR }}>
                <ChevronLeft className="h-6 w-6" />
              </IconButton>
            )}
            <Wallet className="h-6 w-6" />
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">Harcama Planı</h1>
          </div>
          <MonthNav month={month} current={current} onChange={setMonth} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Toplam" value={total} />
            <Stat label="Ödenen" value={paid} tone="good" />
            <Stat label="Kalan" value={total - paid} tone={total - paid > 0 ? 'warn' : undefined} />
          </div>

          {rows.length === 0 ? (
            <div className="py-12 text-center text-muted">Bu ay için planlanmış harcama yok.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {rows.map((e) => (
                <ExpenseRow key={e.id} e={e} today={today} onOpen={() => setEditing(e)} />
              ))}
            </div>
          )}

          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3 text-left text-accent shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
          >
            <Plus className="h-5 w-5" /> Harcama ekle
          </button>
        </div>
      </div>

      {editing && (
        <ExpenseForm
          expense={editing === 'new' ? null : editing}
          defaultDate={month === current ? today : `${month}-01`}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={cx('truncate text-base font-semibold md:text-lg', tone === 'warn' && 'text-danger')}
        style={tone === 'good' ? { color: EXPENSES_COLOR } : undefined}
      >
        {formatMoney(value)}
      </div>
    </div>
  )
}

function ExpenseRow({ e, today, onOpen }: { e: Expense; today: string; onOpen: () => void }) {
  const late = !e.paid_on && e.due_date < today
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(k) => k.key === 'Enter' && onOpen()}
      className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
    >
      <Checkbox
        checked={!!e.paid_on}
        color={EXPENSES_COLOR}
        onChange={() => {
          if (!e.paid_on) playDone()
          updateExpense(e.id, { paid_on: e.paid_on ? null : today })
        }}
      />
      <div className="min-w-0 flex-1">
        <div className={cx('truncate', e.paid_on && 'text-muted line-through')}>{e.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className={cx(late && 'font-medium text-danger')}>{fmt(e.due_date, 'd MMM EEE')}</span>
          {e.recurring && (
            <span className="inline-flex items-center gap-0.5">
              <Repeat className="h-3 w-3" /> Her ay
            </span>
          )}
          {e.paid_on && <span style={{ color: EXPENSES_COLOR }}>Ödendi · {fmt(e.paid_on, 'd MMM')}</span>}
          {late && <span className="font-medium text-danger">Gecikti</span>}
        </div>
      </div>
      <div className={cx('shrink-0 font-semibold tabular-nums', e.paid_on && 'text-muted')}>{formatMoney(e.amount)}</div>
    </div>
  )
}

function ExpenseForm({ expense, defaultDate, onClose }: { expense: Expense | null; defaultDate: string; onClose: () => void }) {
  const today = useToday()
  const [title, setTitle] = useState(expense?.title ?? '')
  const [amount, setAmount] = useState(expense ? String(expense.amount).replace('.', ',') : '')
  const [date, setDate] = useState(expense?.due_date ?? defaultDate)
  const [recurring, setRecurring] = useState(expense?.recurring ?? false)
  const [paidOn, setPaidOn] = useState(expense?.paid_on ?? '')
  const [note, setNote] = useState(expense?.note ?? '')
  const value = parseAmount(amount)
  const valid = title.trim() && Number.isFinite(value) && value >= 0 && date

  const save = () => {
    if (!valid) return
    const data = { title: title.trim(), amount: Math.round(value * 100) / 100, due_date: date, recurring, paid_on: paidOn || null, note }
    if (expense) updateExpense(expense.id, data)
    else createExpense(data)
    onClose()
  }

  return (
    <Modal title={expense ? 'Harcamayı düzenle' : 'Yeni harcama'} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Ne için?">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Kira" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tutar (₺)">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className={cx(inputCls, amount && !Number.isFinite(value) && 'border-danger')}
            />
          </Field>
          <Field label="Ödeme günü">
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="h-4 w-4 accent-accent" />
          <Repeat className="h-4 w-4 text-muted" /> Her ay tekrarla
          {recurring && <span className="text-xs text-muted">(her ayın {Number(sameDayIn(monthOf(date), date).slice(8))}'i)</span>}
        </label>
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-2.5">
          <label className="flex items-center gap-2 text-[15px]">
            <input
              type="checkbox"
              checked={!!paidOn}
              onChange={(e) => setPaidOn(e.target.checked ? today : '')}
              className="h-4 w-4 accent-accent"
            />
            Ödendi
          </label>
          {paidOn && (
            <Field label="Para hangi gün çıktı?">
              <input type="date" value={paidOn} onChange={(e) => e.target.value && setPaidOn(e.target.value)} className={inputCls} />
            </Field>
          )}
        </div>
        <Field label="Not">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={cx(inputCls, 'resize-none')} />
        </Field>
        <div className="mt-1 flex items-center gap-2">
          {expense && (
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2"
              onClick={async () => {
                const ok = await askConfirm({
                  title: `"${expense.title}" silinsin mi?`,
                  message: expense.recurring ? 'Her ay tekrarı da bu aydan itibaren sona erer.' : undefined,
                  confirmText: 'Sil',
                  danger: true,
                })
                if (ok) {
                  deleteExpense(expense.id)
                  onClose()
                }
              }}
            >
              Sil
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-surface-2">
            Vazgeç
          </button>
          <button type="submit" disabled={!valid} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            Kaydet
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}
