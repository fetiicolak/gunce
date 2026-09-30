import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { NewItem } from '../lib/store'
import type { Item } from '../lib/types'
import AddBar from './AddBar'
import TaskRow from './TaskRow'
import { cx, IconButton, useIsDesktop } from './ui'

export interface Section {
  key: string
  title?: string
  tone?: 'danger'
  items: Item[]
}

export default function ListView({
  title,
  color,
  icon,
  subtitle,
  actions,
  sections,
  completed = [],
  addDefaults,
  showList,
  empty,
  back = true,
}: {
  title: ReactNode
  color: string
  icon?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  sections: Section[]
  completed?: Item[]
  addDefaults?: Partial<NewItem> | null
  showList?: boolean
  empty?: ReactNode
  /** Mobilde Listeler'e dönen geri düğmesi */
  back?: boolean
}) {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const [showDone, setShowDone] = useState(false)
  const total = sections.reduce((n, s) => n + s.items.length, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 px-4 md:px-8">
        <div className="flex items-center gap-2 pt-3 md:pt-8">
          {!isDesktop && back && (
            <IconButton onClick={() => navigate('/listeler')} className="-ml-2" aria-label="Geri" style={{ color }}>
              <ChevronLeft className="h-6 w-6" />
            </IconButton>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2" style={{ color }}>
            {icon}
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          </div>
          {actions}
        </div>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {total === 0 && completed.length === 0 && empty && <div className="py-16 text-center text-muted">{empty}</div>}
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <div key={s.key} className="flex flex-col gap-1.5">
                  {s.title && (
                    <div className={cx('mt-3 px-1 text-sm font-semibold', s.tone === 'danger' ? 'text-danger' : 'text-ink')}>
                      {s.title} <span className="font-normal text-muted">{s.items.length}</span>
                    </div>
                  )}
                  {s.items.map((i) => (
                    <TaskRow key={i.id} item={i} showList={showList} />
                  ))}
                </div>
              ),
          )}
          {completed.length > 0 && (
            <>
              <button
                onClick={() => setShowDone(!showDone)}
                className="mt-3 inline-flex w-fit items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-sm font-medium text-ink"
              >
                <ChevronDown className={cx('h-4 w-4 transition-transform', !showDone && '-rotate-90')} />
                Tamamlananlar <span className="text-muted">{completed.length}</span>
              </button>
              {showDone && completed.map((i) => <TaskRow key={i.id} item={i} showList={showList} />)}
            </>
          )}
        </div>
      </div>

      {addDefaults !== null && (
        <div className="shrink-0 px-4 pb-3 md:px-8 md:pb-6">
          <div className="mx-auto max-w-3xl">
            <AddBar defaults={addDefaults ?? {}} />
          </div>
        </div>
      )}
    </div>
  )
}
