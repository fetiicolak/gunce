let ctx: AudioContext | null = null

/** Görev tamamlanınca kısa, tatlı bir "tık-ding" sesi (dosya gerektirmez, Web Audio ile üretilir). */
export function playDone() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    // İki kısa nota: yükselen bir "başardın" tınısı
    for (const [freq, start] of [
      [880, 0],
      [1320, 0.07],
    ] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t + start)
      gain.gain.exponentialRampToValueAtTime(0.18, t + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t + start)
      osc.stop(t + start + 0.2)
    }
  } catch {
    /* ses desteklenmiyorsa sessiz geç */
  }
}
