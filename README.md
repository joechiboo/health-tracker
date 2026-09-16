# Health Tracker

每天量一次體重、記一次晨跑，畫成折線圖，順便看看兩者到底有沒有相關。

- **體重**：日期、體重、體脂（選填）、備註；一天一筆，同日再存會覆蓋
- **晨跑**：日期、距離、時間（選填），自動算配速
- **趨勢圖**：體重日線 + 7 日平均、每日跑量長條，共用同一條時間軸，可**匯出 PNG**
- **相關性**：近 7 日跑量 ↔ 體重、以及 ↔ 之後 7 天體重變化的 Pearson 相關係數
- 兩張表都能**匯出 CSV**（含 BOM，Excel 開不會亂碼）

資料存在 Supabase；沒設定 `.env` 時自動退回瀏覽器 localStorage（離線模式），可以先試用再接雲端。

## 開發

```bash
npm install
npm run dev
```

## 接上 Supabase

資料表放在自己的 **`health` schema**，不佔 `public`——免費方案只給兩個專案，這樣才能跟其他 App 共用同一個 Supabase 專案而不撞表名。

1. 到 [supabase.com](https://supabase.com) 建一個專案（或沿用現有的）
2. **SQL Editor** 貼上 [`supabase/schema.sql`](supabase/schema.sql) 整份執行
3. **Project Settings → API → Data API → Exposed schemas** 加入 `health`（`public` 保留）並存檔
   ——漏了這步前端一律 404。找不到選項的話用 SQL 也行：
   ```sql
   alter role authenticator set pgrst.db_schemas = 'public, graphql_public, health';
   notify pgrst, 'reload config';
   notify pgrst, 'reload schema';   -- 表結構快取要另外叫它重讀
   ```
4. **Project Settings → API** 抄下 Project URL 與 **Publishable key**（`sb_publishable_...`，舊專案叫 anon public key）
5. 複製 `.env.example` 成 `.env`，填入那兩個值
6. `npm run check:supabase` 驗證——它會在兩張表各寫一筆 `1900-01-01` 的哨兵資料、讀回、刪掉，
   確認讀寫與 RLS 都通；卡住時會直接告訴你是 schema 沒開放還是 policy 沒建
7. 重開 `npm run dev`，頁面上的「離線模式」提示消失就是接上了

> ⚠️ 目前不做登入，RLS policy 開放 `anon` 直接讀寫——任何拿到那把 key 的人都能讀寫這兩張表。
> Publishable key 本來就會編進前端 build 產物，部署到 GitHub Pages 等於公開。
> 自己一個人記錄無妨，要多人或想真的鎖起來，`schema.sql` 末尾註解寫了改成 Supabase Auth 的做法。
> （同專案的其他 App 共用同一把 key，但它們的表有各自的 RLS，不受影響。）

## 部署

推上 `gh-pages` 分支給 GitHub Pages：

```bash
npm run deploy
```

網址：https://joechiboo.github.io/health-tracker/

## 怎麼看相關係數

`r` 介於 -1 到 1，負值代表「跑越多、體重越低」。

兩個指標中，**「近 7 日跑量 ↔ 之後 7 天體重變化」比較有意義**——它看的是這週跑量對下週體重的影響，
方向比較接近因果；同期比對那個會被長期體重趨勢本身帶著跑。

樣本少於兩週時數字跳得很厲害，別當真；而且相關不等於因果，飲食、睡眠、壓力都沒進這個模型。

## 技術

Vue 3 + Vite + Chart.js + Supabase．色盤與圖表版型依 Anthropic dataviz 準則（不用雙 Y 軸，改上下兩張圖共用時間軸）。
