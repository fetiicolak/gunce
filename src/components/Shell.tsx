import { useEffect } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, List as ListIcon, Search, Sun } from 'lucide-react'
import { useStore } from '../lib/store'
import { isDone, overdue, useActiveItems, useSettings } from '../lib/selectors'
import { useToday } from '../lib/useToday'
import NavContent from './NavContent'
import ItemDetail from './ItemDetail'
import { cx, useIsDesktop } from './ui'
import SmartListPage from '../pages/SmartListPage'
import ListPage from '../pages/ListPage'
import CalendarPage from '../pages/CalendarPage'
import DayPage from '../pages/DayPage'
import SearchPage from '../pages/SearchPage'
import SettingsPage from '../pages/SettingsPage'

export default function Shell() {
  const isDesktop = useIsDesktop()
  const [params] = useSearchParams()
  const openId = params.get('oge')
  const navigate = useNavigate()

  // Service worker bildirime tıklanınca açık pencereyi yönlendirir
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate') navigate(String(e.data.hash).replace(/^#/, ''))
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [navigate])

  useAppBadge()

  return (
    <div className="flex h-full">
      {isDesktop && (
        <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-surface">
          <NavContent />
        </aside>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <Routes>
          <Route path="/" element={isDesktop ? <Navigate to="/gunum" replace /> : <MobileHome />} />
          <Route path="/gunum" element={<SmartListPage k="gunum" />} />
          <Route path="/onemli" element={<SmartListPage k="onemli" />} />
          <Route path="/planlanan" element={<SmartListPage k="planlanan" />} />
          <Route path="/liste/:id" element={<ListPage />} />
          <Route path="/takvim" element={<CalendarPage />} />
          <Route path="/gun/:date" element={<DayPage />} />
          <Route path="/oge/:id" element={<ItemRedirect />} />
          <Route path="/ara" element={<SearchPage />} />
          <Route path="/ayarlar" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!isDesktop && !openId && <TabBar />}
      </main>
      {openId && <ItemDetail id={openId} />}
    </div>
  )
}

function MobileHome() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <NavContent mobile />
    </div>
  )
}

/** Bildirimden gelen #/oge/:id bağlantısını öğenin listesine yönlendirir. */
function ItemRedirect() {
  const { id } = useParams()
  const item = useStore((s) => (id ? s.items[id] : undefined))
  const ready = useStore((s) => s.ready)
  if (!ready) return null
  if (!item) return <Navigate to="/gunum" replace />
  return <Navigate to={`/liste/${item.list_id}?oge=${item.id}`} replace />
}

function TabBar() {
  const tabs = [
    { to: '/gunum', icon: Sun, label: 'Günüm' },
    { to: '/', icon: ListIcon, label: 'Listeler', end: true },
    { to: '/takvim', icon: CalendarDays, label: 'Takvim' },
    { to: '/ara', icon: Search, label: 'Ara' },
  ]
  return (
    <nav className="pb-safe flex shrink-0 border-t border-line bg-surface">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-accent' : 'text-muted')
          }
        >
          <t.icon className="h-5 w-5" />
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Ana ekran simgesinde bugünün açık görev sayısını gösterir. */
function useAppBadge() {
  const items = useActiveItems()
  const today = useToday()
  const settings = useSettings()
  useEffect(() => {
    const n = items.filter(
      (i) => i.kind === 'task' && !isDone(i, today) && i.due_date && (i.due_date <= today || overdue(i, settings)),
    ).length
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    if (n) nav.setAppBadge?.(n).catch(() => {})
    else nav.clearAppBadge?.().catch(() => {})
  }, [items, today, settings])
}
