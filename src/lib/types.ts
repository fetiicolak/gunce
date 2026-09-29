import type { Recurrence, Reminder } from '@shared/schedule.ts'

export type { Recurrence, Reminder }

export interface List {
  id: string
  user_id: string
  name: string
  color: ListColor
  icon: string
  position: number
  is_default: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Step {
  id: string
  title: string
  done: boolean
}

export interface Item {
  id: string
  user_id: string
  list_id: string
  kind: 'task' | 'reminder'
  title: string
  note: string
  due_date: string | null
  due_time: string | null
  time_explicit: boolean
  important: boolean
  my_day: string | null
  recurrence: Recurrence | null
  steps: Step[]
  reminders: Reminder[]
  completed_at: string | null
  position: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Settings {
  user_id: string
  timezone: string
  default_time: string
  updated_at?: string
}

export type ListColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'green' | 'teal' | 'gray'

export const LIST_COLORS: Record<ListColor, string> = {
  blue: '#2f5fd0',
  purple: '#7c4dcc',
  pink: '#c9408a',
  red: '#d24545',
  orange: '#d9781f',
  green: '#2f9a5b',
  teal: '#1f8f98',
  gray: '#6b7280',
}
