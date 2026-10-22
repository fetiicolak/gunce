// Görev tamamlanınca çalan "ta-da" sesi (public/sounds/tamamlandi.mp3, çevrimdışı için önbellekte)
const SRC = `${import.meta.env.BASE_URL}sounds/tamamlandi.mp3`
let audio: HTMLAudioElement | null = null

export function playDone() {
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
