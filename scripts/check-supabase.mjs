// 連線煙霧測試：讀 .env → 連 Supabase → 兩張表各寫一筆哨兵資料、讀回、刪掉
// 用法：npm run check:supabase
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SENTINEL_DATE = '1900-01-01' // 明顯不可能是真實記錄，測完就刪

function loadEnv() {
  let raw
  try {
    raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  } catch {
    fail('找不到 .env——先 cp .env.example .env 再把 Supabase 的 URL 與 anon key 填進去。')
  }
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) fail('.env 裡缺 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY。')
if (url.includes('xxxxxxxxxxxx')) fail('.env 還是 .env.example 的範本值，換成你自己的專案 URL。')

console.log(`專案：${url}`)
const supabase = createClient(url, key, { db: { schema: 'health' } })

const checks = [
  { table: 'weights', dateKey: 'measured_on', row: { measured_on: SENTINEL_DATE, weight_kg: 60 } },
  { table: 'exercises', dateKey: 'done_on', row: { done_on: SENTINEL_DATE, sport: '測試', duration_min: 1 } },
]

let ok = true
for (const { table, dateKey, row } of checks) {
  process.stdout.write(`\n[${table}]\n`)

  const sel = await supabase.from(table).select('*').limit(1)
  if (sel.error) {
    ok = false
    console.error(`  ✗ 讀取失敗：${sel.error.message}`)
    if (/PGRST106|schema must be one of/i.test(sel.error.message + sel.error.code)) {
      console.error('    → health schema 沒對外開放。Project Settings → API → Data API →')
      console.error('      Exposed schemas 把 health 加進去（public 那些保留著），存檔後再跑一次。')
    } else if (sel.error.message.includes('does not exist')) {
      console.error('    → 表還沒建。到 Supabase SQL Editor 執行 supabase/schema.sql 整份。')
    }
    continue
  }
  console.log(`  ✓ 讀取 OK（目前 ${sel.data.length ? '有' : '沒有'}資料）`)

  const ins = await supabase.from(table).upsert(row, { onConflict: dateKey })
  if (ins.error) {
    ok = false
    console.error(`  ✗ 寫入失敗：${ins.error.message}`)
    if (/row-level security|policy/i.test(ins.error.message)) {
      console.error('    → RLS policy 沒開給 anon。schema.sql 末段的 create policy 有跑到嗎？')
    }
    continue
  }
  console.log('  ✓ 寫入 OK')

  const del = await supabase.from(table).delete().eq(dateKey, SENTINEL_DATE)
  if (del.error) {
    ok = false
    console.error(`  ✗ 刪除失敗（測試資料 ${SENTINEL_DATE} 請手動清掉）：${del.error.message}`)
    continue
  }
  console.log('  ✓ 刪除 OK，測試資料已清乾淨')
}

console.log(ok ? '\n全部通過，可以開 npm run dev 用了。\n' : '\n有項目沒過，照上面的提示修。\n')
process.exit(ok ? 0 : 1)
