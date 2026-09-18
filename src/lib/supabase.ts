import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.MINI_ATS_SUPABASE_URL
const supabaseAnonKey = import.meta.env.MINI_ATS_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null
