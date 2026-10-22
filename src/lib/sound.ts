// Görev tamamlanınca çalan "ta-da" sesi (public/sounds/tamamlandi.mp3, çevrimdışı için önbellekte).
// Web Audio ile çalınır: iPhone/iPad'de <audio> elemanının ses yüksekliği değiştirilemiyor, GainNode ile değişiyor.
const SRC = `${import.meta.env.BASE_URL}sounds/tamamlandi.mp3`
const KEY = 'gunce-sound'
const VOLUME_KEY = 'gunce-sound-volume'

let ctx: AudioContext | null = null
let buffer: Promise<AudioBuffer> | null = null

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* depolama kapalı olabilir */
  }
}

/** Başarı sesi açık mı (cihaza özel tercih, varsayılan açık). */
export const soundEnabled = () => read(KEY) !== '0'
export const setSoundEnabled = (on: boolean) => write(KEY, on ? '1' : '0')

/** Ses yüksekliği 0–1 (cihaza özel, varsayılan %80). */
export function soundVolume(): number {
  const v = Number(read(VOLUME_KEY))
  return read(VOLUME_KEY) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8
}
export const setSoundVolume = (v: number) => write(VOLUME_KEY, String(Math.min(1, Math.max(0, v))))

export function playDone(force = false) {
  if (!force && !soundEnabled()) return
  const volume = soundVolume()
  if (volume <= 0) return
  try {
    ctx ??= new AudioContext()
    const c = ctx
    // Dokunuşun içinde devam ettir; iOS ancak kullanıcı hareketiyle sesi açar
    if (c.state === 'suspended') void c.resume()
    buffer ??= fetch(SRC)
      .then((r) => r.arrayBuffer())
      .then((b) => c.decodeAudioData(b))
    buffer
      .then((buf) => {
        const src = c.createBufferSource()
        const gain = c.createGain()
        src.buffer = buf
        gain.gain.value = volume
        src.connect(gain).connect(c.destination)
        src.start()
      })
      .catch(() => {
        buffer = null // bir dahaki sefere yeniden dene
      })
  } catch {
    /* ses desteklenmiyorsa sessiz geç */
  }
}
