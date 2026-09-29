import { useSearchParams } from 'react-router-dom'

/** Öğe detayını mevcut sayfanın üzerinde açar/kapatır (?oge=<id>). */
export function useOpenItem() {
  const [params, setParams] = useSearchParams()
  return (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('oge', id)
        else next.delete('oge')
        return next
      },
      { replace: !!params.get('oge') },
    )
}
