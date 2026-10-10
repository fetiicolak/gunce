import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, CircleCheckBig, Search } from 'lucide-react'
import TaskRow from '../components/TaskRow'
import { IconButton, useIsDesktop } from '../components/ui'
import { useActiveItems, useLists } from '../lib/selectors'
import { relativeDay, longDay } from '../lib/dates'
import { useToday } from '../lib/useToday'
import type { Item } from '../lib/types'

const COLOR = '#6b7280'

/** Yerel saate göre YYYY-MM-DD */
function localDate(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Tüm tamamlanan görevler, tamamlandığı güne göre gruplu (yeniden eskiye) */
export default function CompletedPage() {
  const items = useActiveItems()
  const lists = useLists()
  const today = useToday()
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const [listId, setListId] = useState('')
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr')
    const done = items
      .filter((i) => i.completed_at && (!listId || i.list_id === listId))
      .filter((i) => !needle || i.title.toLocaleLowerCase('tr').includes(needle))
      .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
    const byDay = new Map<string, Item[]>()
    for (const i of done) {
      const d = localDate(i.completed_at!)
      byDay.set(d, [...(byDay.get(d) ?? []), i])
    }
    return [...byDay.entries()]
  }, [items, listId, q])

  const total = groups.reduce((n, [, g]) => n + g.length, 0)
  const dayTitle = (d: string) => {
    const rel = relativeDay(d, today)
    const long = longDay(d) + (d.slice(0, 4) === today.slice(0, 4) ? '' : ' ' + d.slice(0, 4))
    return ['Bugün', 'Dün'].includes(rel) ? `${rel} · ${long}` : long
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 px-4 md:px-8">
        <div className="flex items-center gap-2 pt-3 md:pt-8">
          {!isDesktop && (
            <IconButton onClick={() => navigate('/listeler')} className="-ml-2" aria-label="Geri" style={{ color: COLOR }}>
              <ChevronLeft className="h-6 w-6" />
            </IconButton>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2" style={{ color: COLOR }}>
            <CircleCheckBig className="h-6 w-6" />
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">Tamamlananlar</h1>
          </div>
          <span className="text-sm text-muted">{total}</span>
        </div>
        <div className="mx-auto mt-3 flex max-w-3xl gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ara"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="max-w-[45%] rounded-lg border border-line bg-surface px-2 py-2 text-ink outline-none"
          >
            <option value="">Tüm listeler</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {total === 0 && <div className="py-16 text-center text-muted">Henüz tamamlanan görev yok.</div>}
          {groups.map(([day, list]) => (
            <div key={day} className="flex flex-col gap-1.5">
              <div className="mt-3 px-1 text-sm font-semibold text-ink">
                {dayTitle(day)} <span className="font-normal text-muted">{list.length}</span>
              </div>
              {list.map((i) => (
                <TaskRow key={i.id} item={i} showList />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
