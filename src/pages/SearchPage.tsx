import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search } from 'lucide-react'
import TaskRow from '../components/TaskRow'
import { IconButton } from '../components/ui'
import { isDone, useActiveItems } from '../lib/selectors'
import { useToday } from '../lib/useToday'

const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ı/g, 'i')

export default function SearchPage() {
  const [q, setQ] = useState('')
  const items = useActiveItems()
  const today = useToday()
  const navigate = useNavigate()

  const results = useMemo(() => {
    const needle = norm(q.trim())
    if (!needle) return []
    return items
      .filter((i) => norm([i.title, i.note, ...i.steps.map((s) => s.title)].join(' ')).includes(needle))
      .sort((a, b) => Number(isDone(a, today)) - Number(isDone(b, today)) || b.updated_at.localeCompare(a.updated_at))
  }, [q, items, today])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 px-4 md:px-8">
        <div className="flex items-center gap-2 pt-3 md:pt-8">
          <IconButton onClick={() => navigate(-1)} className="-ml-2 md:hidden" aria-label="Geri">
            <ChevronLeft className="h-6 w-6" />
          </IconButton>
          <label className="flex flex-1 items-center gap-2 rounded-xl bg-surface px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <Search className="h-5 w-5 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Görev, not veya adım ara"
              className="min-w-0 flex-1 bg-transparent outline-none"
              type="search"
            />
          </label>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {q.trim() && results.length === 0 && <div className="py-16 text-center text-muted">Sonuç bulunamadı.</div>}
          {results.map((i) => (
            <TaskRow key={i.id} item={i} showList />
          ))}
        </div>
      </div>
    </div>
  )
}
