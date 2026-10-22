// Görev tamamlanınca çalan "ta-da" sesi (public/sounds/tamamlandi.mp3, çevrimdışı için önbellekte)
const SRC = `${import.meta.env.BASE_URL}sounds/tamamlandi.mp3`
const KEY = 'gunce-sound'
let audio: HTMLAudioElement | null = null

/** Başarı sesi açık mı (cihaza özel tercih, varsayılan açık). */
export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* depolama kapalı olabilir */
  }
}

export function playDone(force = false) {
  if (!force && !soundEnabled()) return
  try {
    audio ??= new Audio(SRC)
    audio.currentTime = 0
    void audio.play().catch(() => {
      /* tarayıcı izin vermezse sessiz geç */
    })
  } catch {
    /* ses desteklenmiyorsa sessiz geç */
  }
}
