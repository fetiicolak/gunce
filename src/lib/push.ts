import { supabase } from './supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function deviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android telefon' : 'Android tablet'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : 'Tarayıcı'
  if (/Windows/.test(ua)) return `Windows · ${browser}`
  if (/Mac/.test(ua)) return `Mac · ${browser}`
  return browser
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth, device_name: deviceName() },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Bu tarayıcı bildirimleri desteklemiyor.')
  if (!VAPID) throw new Error('VAPID anahtarı ayarlanmamış.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Bildirim izni verilmedi.')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }))
  await saveSubscription(sub)
}

/** Açılışta mevcut aboneliği sunucuyla eşitle (iOS aboneliği yenileyebiliyor). */
export async function refreshSubscription() {
  const sub = await currentSubscription()
  if (sub && Notification.permission === 'granted') await saveSubscription(sub).catch(() => {})
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestNotification(): Promise<void> {
  const { error } = await supabase.functions.invoke('dispatch', { body: { test: true } })
  if (error) throw error
}
