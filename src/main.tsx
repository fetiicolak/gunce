import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Tema "Sistem" ise işletim sistemi değişince uyum sağla
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  try {
    if (localStorage.getItem('gunce-theme')) return
  } catch {
    /* yok say */
  }
  document.documentElement.classList.toggle('dark', e.matches)
})

// Boş bir yere dokununca klavyeyi kapat (iOS ana ekran uygulamasında kendiliğinden kapanmıyor)
document.addEventListener(
  'pointerdown',
  (e) => {
    const active = document.activeElement as HTMLElement | null
    if (!active || !active.matches('input, textarea, select, [contenteditable="true"]')) return
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, button, a, label, [role="button"], [role="checkbox"], [contenteditable="true"]')) return
    active.blur()
  },
  true,
)
