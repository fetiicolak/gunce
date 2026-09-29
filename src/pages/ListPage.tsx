import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Home, List as ListIcon, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import ListView from '../components/ListView'
import { IconButton, cx } from '../components/ui'
import { deleteList, updateList, useStore } from '../lib/store'
import { isDone, sortItems, useActiveItems } from '../lib/selectors'
import { useToday } from '../lib/useToday'
import { LIST_COLORS, type ListColor } from '../lib/types'

export default function ListPage() {
  const { id } = useParams()
  const list = useStore((s) => (id ? s.lists[id] : undefined))
  const hasLists = useStore((s) => Object.keys(s.lists).length > 0)
  const items = useActiveItems()
  const today = useToday()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const { open, done } = useMemo(() => {
    const mine = items.filter((i) => i.list_id === id)
    return {
      open: sortItems(mine.filter((i) => !isDone(i, today))),
      done: mine
        .filter((i) => isDone(i, today))
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    }
  }, [items, id, today])

  if (!list || list.deleted_at) return hasLists ? <Navigate to="/" replace /> : null
  const color = LIST_COLORS[list.color]

  const title = renaming ? (
    <input
      autoFocus
      defaultValue={list.name}
      onBlur={(e) => {
        const v = e.target.value.trim()
        if (v) updateList(list.id, { name: v })
        setRenaming(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setRenaming(false)
      }}
      className="w-full bg-transparent outline-none"
    />
  ) : (
    <span onDoubleClick={() => setRenaming(true)}>{list.name}</span>
  )

  const actions = (
    <div className="relative">
      <IconButton aria-label="Liste seçenekleri" onClick={() => setMenu(!menu)}>
        <MoreHorizontal className="h-5 w-5" />
      </IconButton>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-line bg-surface p-2 shadow-lg">
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
              onClick={() => {
                setMenu(false)
                setRenaming(true)
              }}
            >
              <Pencil className="h-4 w-4" /> Yeniden adlandır
            </button>
            <div className="px-2 pb-1 pt-2 text-xs font-medium text-muted">Renk</div>
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {(Object.keys(LIST_COLORS) as ListColor[]).map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => updateList(list.id, { color: c })}
                  className={cx('h-6 w-6 rounded-full', list.color === c && 'outline-2 outline-offset-2')}
                  style={{ background: LIST_COLORS[c], outlineColor: LIST_COLORS[c] }}
                />
              ))}
            </div>
            {!list.is_default && (
              <button
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-danger hover:bg-surface-2"
                onClick={() => {
                  if (confirm(`"${list.name}" listesi ve içindeki ${open.length + done.length} öğe silinsin mi?`)) {
                    deleteList(list.id)
                    navigate('/', { replace: true })
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Listeyi sil
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )

  return (
    <ListView
      title={title}
      color={color}
      icon={list.is_default ? <Home className="h-6 w-6" /> : <ListIcon className="h-6 w-6" />}
      actions={actions}
      sections={[{ key: 'open', items: open }]}
      completed={done}
      addDefaults={{ list_id: list.id }}
      empty="Bu liste boş. Aşağıdan ilk görevini ekle."
    />
  )
}
