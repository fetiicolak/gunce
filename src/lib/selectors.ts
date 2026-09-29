import { useMemo } from 'react'
import { isOverdue, occurrencesBetween } from '@shared/schedule.ts'
import { useSettings, useStore } from './store'
import { useToday } from './useToday'
import type { Item, List, Settings } from './types'

export function useLists(): List[] {
  const lists = useStore((s) => s.lists)
  return useMemo(
    () =>
      Object.values(lists)
        .filter((l) => !l.deleted_at)
        .sort((a, b) => (a.is_default === b.is_default ? a.position - b.position : a.is_default ? -1 : 1)),
    [lists],
  )
}

export function useActiveItems(): Item[] {
  const items = useStore((s) => s.items)
  return useMemo(() => Object.values(items).filter((i) => !i.deleted_at), [items])
}

/** Hatırlatmalar tiklenmez; tekrarsız bir hatırlatmanın günü geçtiyse tamamlanmış sayılır. */
export function isDone(item: Item, today: string): boolean {
  if (item.completed_at) return true
  return item.kind === 'reminder' && !item.recurrence && !!item.due_date && item.due_date < today
}

export function overdue(item: Item, settings: Settings): boolean {
  return isOverdue(item, settings)
}

export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => a.position - b.position)
}

export type SmartKey = 'gunum' | 'onemli' | 'planlanan'

export function smartFilter(key: SmartKey, today: string) {
  return (i: Item) => {
    switch (key) {
      case 'gunum':
        return i.my_day === today || (!!i.due_date && (i.due_date === today || (i.due_date < today && !isDone(i, today))))
      case 'onemli':
        return i.important
      case 'planlanan':
        return !!i.due_date
    }
  }
}

export function useCounts() {
  const items = useActiveItems()
  const today = useToday()
  return useMemo(() => {
    const open = items.filter((i) => !isDone(i, today))
    const byList: Record<string, number> = {}
    for (const i of open) byList[i.list_id] = (byList[i.list_id] ?? 0) + 1
    return {
      gunum: open.filter(smartFilter('gunum', today)).length,
      onemli: open.filter(smartFilter('onemli', today)).length,
      planlanan: open.filter(smartFilter('planlanan', today)).length,
      byList,
    }
  }, [items, today])
}

export interface Occurrence {
  item: Item
  date: string
  /** Tekrarlayan öğenin ileriki (henüz oluşmamış) tekrarı */
  virtual: boolean
}

/** [from, to] aralığındaki her gün için o güne düşen öğeler (tekrarlar dahil). */
export function occurrencesByDay(items: Item[], from: string, to: string): Map<string, Occurrence[]> {
  const map = new Map<string, Occurrence[]>()
  const push = (o: Occurrence) => {
    const list = map.get(o.date) ?? []
    list.push(o)
    map.set(o.date, list)
  }
  for (const item of items) {
    if (!item.due_date) continue
    const rec = item.completed_at ? null : item.recurrence
    for (const date of occurrencesBetween(item.due_date, rec, from, to)) {
      push({ item, date, virtual: date !== item.due_date })
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.item.due_time ?? '99').localeCompare(b.item.due_time ?? '99') || a.item.position - b.item.position)
  }
  return map
}

export { useSettings }
