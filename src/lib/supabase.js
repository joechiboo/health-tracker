import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// 沒設定 .env 時回傳 null，store 會退回 localStorage（離線模式）
export const supabase = url && key ? createClient(url, key) : null
export const hasSupabase = !!supabase
