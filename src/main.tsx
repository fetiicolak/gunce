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
