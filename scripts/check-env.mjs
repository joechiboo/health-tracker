// 發佈前的保險：Vite 是 build 當下把 VITE_SUPABASE_* 寫死進 bundle 的，
// 少了 .env 就會做出一份「離線模式」的網站，上線後資料只存在使用者的瀏覽器。
// 這種失誤從畫面上看不出來（頁面照常運作），所以在 deploy 前擋一次。
import { readFileSync } from 'node:fs'

const env = { ...process.env } // CI 用環境變數餵也算數
try {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  /* 沒有 .env，下面一樣會擋下來 */
}

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
const bad = !url || !key || url.includes('xxxxxxxxxxxx') || key.includes('xxxxxxxx')

if (bad) {
  console.error(`
✗ 找不到可用的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。

  這樣 build 出來的網站會是「離線模式」——資料只存在每個人自己的瀏覽器，
  連不到 Supabase。多半是因為在沒有 .env 的機器（CI、雲端容器）上發佈。

  → 在有 .env 的機器上重跑 npm run deploy
  → 或先 cp .env.example .env 填好那兩個值
  → 真的就是要發佈離線版：npm run deploy:offline
`)
  process.exit(1)
}

console.log(`✓ 會連到 ${url}`)
