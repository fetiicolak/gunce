import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const configured = Boolean(SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'anon',
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'gunce-auth' } },
)
