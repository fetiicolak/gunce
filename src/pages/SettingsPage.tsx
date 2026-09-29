import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronLeft, Clock, Globe, LogOut, Moon, RefreshCw, Share, Smartphone, Trash2 } from 'lucide-react'
import { IconButton, inputCls, Segmented, cx } from '../components/ui'
import { flush, pull, updateSettings, useSettings, useStore } from '../lib/store'
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIOS,
  isStandalone,
  pushSupported,
  sendTestNotification,
} from '../lib/push'
import { supabase } from '../lib/supabase'

type Theme = 'system' | 'light' | 'dark'

function applyTheme(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem('gunce-theme')
    else localStorage.setItem('gunce-theme', t)
  } catch {
    /* depolama kapalı olabilir */
  }
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

function readTheme(): Theme {
  try {
    return (localStorage.getItem('gunce-theme') as Theme) || 'system'
  } catch {
    return 'system'
  }
}

interface Device {
  id: string
  endpoint: string
  device_name: string
  created_at: string
  last_used_at: string | null
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  const zones = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
    } catch {
      return [settings.timezone]
    }
  })()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 px-4 md:px-8">
        <div className="flex items-center gap-2 pt-3 md:pt-8">
          <IconButton onClick={() => navigate(-1)} className="-ml-2" aria-label="Geri">
            <ChevronLeft className="h-6 w-6" />
          </IconButton>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ayarlar</h1>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <NotificationsCard />

          <Card title="Zamanlama">
            <Row icon={<Clock className="h-5 w-5" />} title="Varsayılan saat" hint="Saat girilmeyen öğeler ve sabah özeti bu saatte bildirilir.">
              <input
                type="time"
                value={settings.default_time.slice(0, 5)}
                onChange={(e) => e.target.value && updateSettings({ default_time: e.target.value })}
                className={cx(inputCls, 'w-32')}
              />
            </Row>
            <Row icon={<Globe className="h-5 w-5" />} title="Saat dilimi">
              <select
                value={settings.timezone}
                onChange={(e) => updateSettings({ timezone: e.target.value })}
                className={cx(inputCls, 'max-w-56')}
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </Row>
          </Card>

          <Card title="Görünüm">
            <Row icon={<Moon className="h-5 w-5" />} title="Tema">
              <Segmented
                value={theme}
                onChange={(t) => {
                  setTheme(t)
                  applyTheme(t)
                }}
                options={[
                  { value: 'system', label: 'Sistem' },
                  { value: 'light', label: 'Açık' },
                  { value: 'dark', label: 'Koyu' },
                ]}
              />
            </Row>
          </Card>

          <SyncCard />

          <Card title="Hesap">
            <Row icon={<LogOut className="h-5 w-5" />} title={email || 'Oturum açık'}>
              <button
                onClick={() => confirm('Çıkış yapılsın mı?') && supabase.auth.signOut()}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-danger hover:bg-surface-2"
              >
                Çıkış yap
              </button>
            </Row>
          </Card>

          <p className="text-center text-xs text-muted">Günce · sürüm {__APP_VERSION__}</p>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-sm font-semibold text-muted">{title}</h2>
      <div className="divide-y divide-line rounded-xl bg-surface">{children}</div>
    </section>
  )
}

function Row({ icon, title, hint, children }: { icon: ReactNode; title: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px]">{title}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function NotificationsCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [endpoint, setEndpoint] = useState<string | null>(null)

  const refresh = async () => {
    const sub = await currentSubscription().catch(() => null)
    setEnabled(!!sub && Notification.permission === 'granted')
    setEndpoint(sub?.endpoint ?? null)
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,device_name,created_at,last_used_at')
      .order('created_at')
    setDevices((data as Device[]) ?? [])
  }
  useEffect(() => {
    refresh()
  }, [])

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      if (ok) setMsg(ok)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const needsInstall = isIOS() && !isStandalone()

  return (
    <Card title="Bildirimler">
      {needsInstall ? (
        <div className="flex flex-col gap-2 px-4 py-4 text-[15px]">
          <div className="flex items-center gap-2 font-medium">
            <Smartphone className="h-5 w-5 text-accent" /> Önce ana ekrana ekleyin
          </div>
          <p className="text-sm text-muted">
            iPhone'da bildirimler yalnızca ana ekrana eklenmiş uygulamada çalışır. Safari'de alttaki{' '}
            <Share className="inline h-4 w-4 align-text-bottom" /> <b>Paylaş</b> düğmesine dokunun, <b>Ana Ekrana Ekle</b>'yi
            seçin, sonra Günce'yi ana ekrandan açıp buraya geri gelin.
          </p>
        </div>
      ) : !pushSupported() ? (
        <Row icon={<Bell className="h-5 w-5" />} title="Bu tarayıcı bildirimleri desteklemiyor" />
      ) : (
        <Row
          icon={<Bell className="h-5 w-5" />}
          title="Bu cihazda bildirimler"
          hint={enabled ? 'Açık' : Notification.permission === 'denied' ? 'İzin reddedilmiş; cihaz ayarlarından açın' : 'Kapalı'}
        >
          {enabled ? (
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => run(sendTestNotification, 'Deneme bildirimi gönderildi.')}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
              >
                Dene
              </button>
              <button
                disabled={busy}
                onClick={() => run(disablePush)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-danger hover:bg-surface-2"
              >
                Kapat
              </button>
            </div>
          ) : (
            <button
              disabled={busy}
              onClick={() => run(enablePush, 'Bildirimler açıldı.')}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Bildirimleri aç
            </button>
          )}
        </Row>
      )}
      {msg && <div className="px-4 py-2 text-sm text-muted">{msg}</div>}
      {devices.length > 0 && (
        <div className="px-4 py-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Bildirim alan cihazlar</div>
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-2 py-1 text-sm">
              <span className="flex-1">
                {d.device_name || 'Cihaz'}
                {d.endpoint === endpoint && <span className="text-muted"> · bu cihaz</span>}
              </span>
              <IconButton
                aria-label="Cihazı kaldır"
                onClick={async () => {
                  await supabase.from('push_subscriptions').delete().eq('id', d.id)
                  refresh()
                }}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function SyncCard() {
  const online = useStore((s) => s.online)
  const syncing = useStore((s) => s.syncing)
  const pending = useStore((s) => Object.keys(s.outbox).length)
  const lastError = useStore((s) => s.lastError)
  const status = !online
    ? 'Çevrimdışı — değişiklikler bağlantı gelince gönderilecek'
    : syncing
      ? 'Eşitleniyor…'
      : pending
        ? `${pending} değişiklik gönderilmeyi bekliyor`
        : 'Tüm cihazlarla eşit'
  return (
    <Card title="Senkron">
      <Row icon={<RefreshCw className={cx('h-5 w-5', syncing && 'animate-spin')} />} title={status} hint={lastError ?? undefined}>
        <button
          disabled={!online}
          onClick={() => pull().then(flush)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          Şimdi eşitle
        </button>
      </Row>
    </Card>
  )
}
