import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './ui'

/** Ortada açılan pencere (telefonda alttan çıkan sayfa). Esc veya dışarı tıklama kapatır. */
export default function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="pb-safe max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 text-ink shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</div>
          <IconButton onClick={onClose} aria-label="Kapat" className="-mr-2">
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}
