import { useEffect, useState } from 'react'
import { zonedParts } from '@shared/schedule.ts'
import { useSettings } from './store'

/** Kullanıcının saat dilimindeki bugünün tarihi; gün değişince günceller. */
export function useToday(): string {
  const { timezone } = useSettings()
  const [today, setToday] = useState(() => zonedParts(Date.now(), timezone).date)
  useEffect(() => {
    const tick = () => setToday(zonedParts(Date.now(), timezone).date)
    tick()
    const t = setInterval(tick, 60_000)
    return () => clearInterval(t)
  }, [timezone])
  return today
}

/** Dakikada bir yenilenen "şimdi" — gecikmiş durumunu güncel tutmak için. */
export function useNow(): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}
