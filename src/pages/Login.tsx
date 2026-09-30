import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { inputCls, Logo } from '../components/ui'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  // Aynı github.io alan adındaki başka sitelerin kayıtlı şifreleri otomatik dolmasın diye
  // alanlar dokunulana kadar salt okunur kalır (tarayıcılar salt okunur alanları doldurmaz).
  const [unlocked, setUnlocked] = useState(false)
  const unlock = { readOnly: !unlocked, onPointerDown: () => setUnlocked(true), onFocus: () => setUnlocked(true) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: location.origin + location.pathname },
          })
    setBusy(false)
    if (error) {
      setMsg(
        error.message.includes('Invalid login')
          ? 'E-posta veya şifre hatalı.'
          : error.message.includes('Signups not allowed')
            ? 'Yeni kayıt kapalı.'
            : error.message,
      )
    } else if (mode === 'up' && !data.session) {
      setMsg('Hesap oluşturuldu. E-postanıza gelen bağlantıyla doğrulayıp giriş yapın.')
      setMode('in')
    }
  }

  return (
    <div className="pt-safe flex min-h-full items-center justify-center p-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
        <div className="mb-4 flex flex-col items-center gap-3">
          <Logo className="h-20 w-20" />
          <h1 className="text-3xl font-bold tracking-tight">Günce</h1>
          <p className="text-sm text-muted">Görevler, hatırlatmalar ve takvim</p>
        </div>
        <input
          type="email"
          autoComplete="off"
          {...unlock}
          required
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls + ' py-3'}
        />
        <input
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          {...unlock}
          required
          minLength={6}
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls + ' py-3'}
        />
        <button disabled={busy} className="rounded-lg bg-accent py-3 font-semibold text-white disabled:opacity-60">
          {mode === 'in' ? 'Giriş yap' : 'Hesap oluştur'}
        </button>
        {msg && <p className="text-center text-sm text-muted">{msg}</p>}
        {/* Yeni kayıtlar Supabase'de kapalı; herkese açılırsa VITE_ALLOW_SIGNUP=1 ile geri gelir */}
        {import.meta.env.VITE_ALLOW_SIGNUP === '1' && (
          <button
            type="button"
            onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
            className="mt-2 text-center text-sm text-accent"
          >
            {mode === 'in' ? 'İlk kez mi? Hesap oluştur' : 'Zaten hesabım var'}
          </button>
        )}
      </form>
    </div>
  )
}
