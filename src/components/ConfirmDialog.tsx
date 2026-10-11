import { useEffect, useState } from 'react'

type Request = {
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

let show: ((r: Request) => void) | null = null

/** Tarayıcının confirm() penceresi yerine uygulama içi onay. */
export function askConfirm(opts: Omit<Request, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(window.confirm(opts.title))
    show({ ...opts, resolve })
  })
}

/** Uygulamanın köküne bir kez yerleştirilir. */
export default function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null)

  useEffect(() => {
    show = setReq
    return () => {
      show = null
    }
  }, [])

  const close = (ok: boolean) => {
    req?.resolve(ok)
    setReq(null)
  }

  useEffect(() => {
    if (!req) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      else if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!req) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 text-ink shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold break-words">{req.title}</div>
        {req.message && <div className="mt-1.5 text-sm text-muted">{req.message}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-surface-2"
            onClick={() => close(false)}
          >
            Vazgeç
          </button>
          <button
            autoFocus
            className={
              'rounded-lg px-4 py-2 text-sm font-medium text-white ' +
              (req.danger ? 'bg-danger hover:opacity-90' : 'bg-accent hover:opacity-90')
            }
            onClick={() => close(true)}
          >
            {req.confirmText ?? 'Tamam'}
          </button>
        </div>
      </div>
    </div>
  )
}
