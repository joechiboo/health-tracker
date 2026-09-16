import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// 這個 App 的表放在 health schema（Supabase 專案可能跟別的 App 共用，不佔 public）
// 記得到 Project Settings → API → Exposed schemas 把 health 加進去。
// 沒設定 .env 時回傳 null，store 會退回 localStorage（離線模式）
export const supabase =
  url && key ? createClient(url, key, { db: { schema: 'health' } }) : null
export const hasSupabase = !!supabase
