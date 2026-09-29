import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { HashRouter } from 'react-router-dom'
import { configured, supabase } from './lib/supabase'
import { initStore, resetStore } from './lib/store'
import { refreshSubscription } from './lib/push'
import Login from './pages/Login'
import Shell from './components/Shell'
import { Logo } from './components/ui'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_OUT') resetStore()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    initStore(userId)
    refreshSubscription()
  }, [userId])

  if (!configured) return import.meta.env.DEV ? <DemoApp /> : <SetupNeeded />
  if (session === undefined) return <Splash />
  if (!session) return <Login />
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

/** Supabase ayarlanmadan arayüzü denemek için yalnızca geliştirmede kullanılır. */
function DemoApp() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    initStore('00000000-0000-4000-8000-000000000000', { localOnly: true }).then(() => setReady(true))
  }, [])
  if (!ready) return <Splash />
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <Logo className="h-16 w-16 animate-pulse" />
    </div>
  )
}

function SetupNeeded() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo className="h-16 w-16" />
      <h1 className="text-xl font-semibold">Günce henüz yapılandırılmadı</h1>
      <p className="text-muted">
        <code>VITE_SUPABASE_URL</code> ve <code>VITE_SUPABASE_ANON_KEY</code> ortam değişkenlerini ayarlayın.
      </p>
    </div>
  )
}
