import { useMemo } from 'react'
import { CalendarCheck, Star, Sun } from 'lucide-react'
import { addDays } from '@shared/schedule.ts'
import ListView, { type Section } from '../components/ListView'
import { isDone, smartFilter, sortItems, useActiveItems, type SmartKey } from '../lib/selectors'
import { longDay, startOfWeek } from '../lib/dates'
import { useToday } from '../lib/useToday'

const META: Record<SmartKey, { title: string; color: string; icon: React.ReactNode; empty: string }> = {
  gunum: { title: 'Günüm', color: '#d9781f', icon: <Sun className="h-6 w-6" />, empty: 'Bugün için bir şey yok. Güzel bir gün!' },
  onemli: { title: 'Önemli', color: '#c9408a', icon: <Star className="h-6 w-6" />, empty: 'Yıldızladığın görevler burada görünür.' },
  planlanan: {
    title: 'Planlanan',
    color: '#2f9a5b',
    icon: <CalendarCheck className="h-6 w-6" />,
    empty: 'Tarihi olan görevler burada görünür.',
  },
}

export default function SmartListPage({ k }: { k: SmartKey }) {
  const items = useActiveItems()
  const today = useToday()
  const meta = META[k]

  const { sections, completed } = useMemo(() => {
    const matching = items.filter(smartFilter(k, today))
    const open = sortItems(matching.filter((i) => !isDone(i, today)))
    const done = matching
      .filter((i) => isDone(i, today))
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    let sections: Section[]
    if (k === 'gunum') {
      const late = open.filter((i) => i.due_date && i.due_date < today)
      sections = [
        { key: 'late', title: 'Gecikmiş', tone: 'danger', items: late },
        { key: 'today', title: late.length ? 'Bugün' : undefined, items: open.filter((i) => !i.due_date || i.due_date >= today) },
      ]
    } else if (k === 'planlanan') {
      const byDate = [...open].sort((a, b) =>
        (a.due_date! + (a.due_time ?? '')).localeCompare(b.due_date! + (b.due_time ?? '')),
      )
      const tomorrow = addDays(today, 1)
      const weekEnd = addDays(startOfWeek(today), 6)
      sections = [
        { key: 'late', title: 'Gecikmiş', tone: 'danger', items: byDate.filter((i) => i.due_date! < today) },
        { key: 'today', title: 'Bugün', items: byDate.filter((i) => i.due_date === today) },
        { key: 'tomorrow', title: 'Yarın', items: byDate.filter((i) => i.due_date === tomorrow) },
        { key: 'week', title: 'Bu hafta', items: byDate.filter((i) => i.due_date! > tomorrow && i.due_date! <= weekEnd) },
        { key: 'later', title: 'Daha sonra', items: byDate.filter((i) => i.due_date! > weekEnd && i.due_date! > tomorrow) },
      ]
    } else {
      sections = [{ key: 'all', items: open }]
    }
    return { sections, completed: k === 'planlanan' ? [] : done }
  }, [items, today, k])

  return (
    <ListView
      title={meta.title}
      color={meta.color}
      icon={meta.icon}
      subtitle={k === 'gunum' ? longDay(today) : undefined}
      sections={sections}
      completed={completed}
      showList
      back={k !== 'gunum'}
      empty={meta.empty}
      addDefaults={
        k === 'onemli' ? { important: true } : k === 'gunum' ? { due_date: today, my_day: today } : { due_date: today }
      }
    />
  )
}
