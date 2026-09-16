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

1. 到 [supabase.com](https://supabase.com) 建一個專案
2. 專案的 **SQL Editor** 貼上 [`supabase/schema.sql`](supabase/schema.sql) 整份執行，建出 `weights` / `runs` 兩張表
3. **Project Settings → API** 抄下 Project URL 與 `anon` public key
4. 複製 `.env.example` 成 `.env`，填入那兩個值
5. 重開 `npm run dev`，頁面上的「離線模式」提示消失就是接上了

> ⚠️ 目前不做登入，RLS policy 開放 `anon` 直接讀寫——任何拿到 anon key 的人都能讀寫這兩張表，
> 也包含部署到 GitHub Pages 後 build 產物裡的那把 key。自己一個人記錄無妨，
> 要多人或想真的鎖起來，`schema.sql` 末尾註解寫了改成 Supabase Auth 的做法。

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
