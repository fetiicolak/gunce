import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarCheck, CalendarDays, Home, List as ListIcon, Plus, Search, Settings, Star, Sun, WifiOff } from 'lucide-react'
import { createList, useStore } from '../lib/store'
import { useCounts, useLists } from '../lib/selectors'
import { LIST_COLORS } from '../lib/types'
import { cx, IconButton, Logo } from './ui'
import { useNavigate } from 'react-router-dom'

export default function NavContent({ mobile }: { mobile?: boolean }) {
  const lists = useLists()
  const counts = useCounts()
  const online = useStore((s) => s.online)
  const pending = useStore((s) => Object.keys(s.outbox).length)
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const submit = () => {
    const n = name.trim()
    setAdding(false)
    setName('')
    if (n) navigate(`/liste/${createList(n).id}`)
  }

  const row = (to: string, icon: React.ReactNode, label: string, count?: number, color?: string) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-lg px-3 text-[15px] transition-colors',
          mobile ? 'py-3' : 'py-2',
          isActive && !mobile ? 'bg-accent-soft font-medium text-ink' : 'text-ink hover:bg-surface-2',
        )
      }
    >
      <span style={{ color }} className="flex h-5 w-5 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!count && <span className="text-sm text-muted">{count}</span>}
    </NavLink>
  )

  return (
    <div className="pt-safe flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <Logo className="h-8 w-8" />
        <span className="flex-1 text-xl font-semibold tracking-tight">Günce</span>
        {(!online || pending > 0) && (
          <span title={online ? 'Senkronize ediliyor' : 'Çevrimdışı'} className="text-muted">
            {online ? <span className="text-xs">{pending}↑</span> : <WifiOff className="h-4 w-4" />}
          </span>
        )}
        {!mobile && (
          <IconButton title="Ara" onClick={() => navigate('/ara')}>
            <Search className="h-4.5 w-4.5" />
          </IconButton>
        )}
        <IconButton title="Ayarlar" onClick={() => navigate('/ayarlar')}>
          <Settings className="h-4.5 w-4.5" />
        </IconButton>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-2 pb-4">
        {row('/gunum', <Sun className="h-5 w-5" />, 'Günüm', counts.gunum, '#d9781f')}
        {row('/onemli', <Star className="h-5 w-5" />, 'Önemli', counts.onemli, '#c9408a')}
        {row('/planlanan', <CalendarCheck className="h-5 w-5" />, 'Planlanan', counts.planlanan, '#2f9a5b')}
        {!mobile && row('/takvim', <CalendarDays className="h-5 w-5" />, 'Takvim', undefined, '#1f8f98')}

        <div className="mx-3 my-2 border-t border-line" />

        {lists.map((l) =>
          row(
            `/liste/${l.id}`,
            l.is_default ? <Home className="h-5 w-5" /> : <ListIcon className="h-5 w-5" />,
            l.name,
            counts.byList[l.id],
            LIST_COLORS[l.color],
          ),
        )}

        {adding ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <ListIcon className="h-5 w-5 text-muted" />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') {
                  setName('')
                  setAdding(false)
                }
              }}
              placeholder="Liste adı"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className={cx(
              'flex w-full items-center gap-3 rounded-lg px-3 text-[15px] text-accent hover:bg-surface-2',
              mobile ? 'py-3' : 'py-2',
            )}
          >
            <Plus className="h-5 w-5" />
            Yeni liste
          </button>
        )}
      </nav>
    </div>
  )
}
