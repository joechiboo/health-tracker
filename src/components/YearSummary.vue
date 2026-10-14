<script setup>
import { ref, computed } from 'vue'
import { state, addExercises, deleteExercise } from '../lib/store'
import { today } from '../utils/csv'
import { parseNotepad, guessSport } from '../utils/notepad'

const thisYear = Number(today().slice(0, 4))
const year = ref(thisYear)

const hours = (min) => Number(min || 0) / 60
const fmtH = (h) => (Math.round(h * 10) / 10).toString()

const ofYear = (y) => state.exercises.filter((e) => e.done_on.startsWith(`${y}-`))

// 新的在上面，編號照時間先後（跟記事本一樣）
const list = computed(() => {
  const rows = ofYear(year.value)
  return rows.map((r, i) => ({ ...r, no: i + 1 })).reverse()
})

const summary = computed(() => {
  const rows = ofYear(year.value)
  const totalH = rows.reduce((a, r) => a + hours(r.duration_min), 0)
  // 去年同期：今年看到今天為止，跟去年同一個月日比
  const cutoff = year.value === thisYear ? today().slice(5) : '12-31'
  const last = ofYear(year.value - 1).filter((r) => r.done_on.slice(5) <= cutoff)
  return {
    count: rows.length,
    totalH,
    days: new Set(rows.map((r) => r.done_on)).size,
    lastCount: last.length,
    lastH: last.reduce((a, r) => a + hours(r.duration_min), 0),
  }
})

// ── 年度目標（小時），存在這台瀏覽器 ──
const GOAL_KEY = 'health-tracker:goal-hours'
const readGoal = () => {
  try {
    return Number(localStorage.getItem(GOAL_KEY)) || 100
  } catch {
    return 100
  }
}
const goal = ref(readGoal())
function setGoal() {
  const v = Number(prompt('今年目標幾小時？', goal.value))
  if (!(v > 0)) return
  goal.value = v
  try {
    localStorage.setItem(GOAL_KEY, String(v))
  } catch {
    /* 存不了就只在這次有效 */
  }
}

const progress = computed(() => {
  const done = summary.value.totalH
  const pct = Math.min(100, (done / goal.value) * 100)
  if (year.value !== thisYear) return { pct, done, ahead: null }
  // 照進度今天應該到哪
  const start = Date.UTC(thisYear, 0, 1)
  const end = Date.UTC(thisYear + 1, 0, 1)
  const now = Date.parse(today() + 'T00:00:00Z') + 86400000 // 含今天
  const yearPct = (now - start) / (end - start)
  const expected = goal.value * yearPct
  const daysLeft = Math.round((end - now) / 86400000)
  const remain = Math.max(0, goal.value - done)
  return {
    pct,
    done,
    expected,
    expectedPct: yearPct * 100,
    ahead: done - expected,
    remain,
    perWeek: daysLeft > 0 ? (remain / daysLeft) * 7 : 0,
  }
})

const diff = (a, b, fmt = (x) => x) => (a >= b ? `+${fmt(a - b)}` : `−${fmt(b - a)}`)

// ── 快速記一筆 ──
const lastHours = () => {
  const r = state.exercises[state.exercises.length - 1]
  return r ? fmtH(hours(r.duration_min)) : '0.4'
}
const form = ref({ done_on: today(), hours: '', note: '' })
const saving = ref(false)

async function submit() {
  const h = form.value.hours === '' ? Number(lastHours()) : Number(form.value.hours)
  if (!form.value.done_on || !(h > 0)) return
  saving.value = true
  const note = form.value.note.trim() || null
  const ok = await addExercises([
    { done_on: form.value.done_on, sport: guessSport(note), duration_min: Math.round(h * 60), distance_km: null, note },
  ])
  saving.value = false
  if (ok) {
    form.value = { done_on: today(), hours: '', note: '' }
  }
}

function remove(row) {
  if (confirm(`刪除 ${row.done_on} ${fmtH(hours(row.duration_min))} 小時？`)) deleteExercise(row.id)
}

// ── 從記事本匯入 ──
const importText = ref('')
const importMsg = ref('')
const importing = ref(false)
const preview = computed(() => (importText.value.trim() ? parseNotepad(importText.value, thisYear) : null))

async function runImport() {
  if (!preview.value?.rows.length) return
  // 已經有的就跳過，重貼一次也不會重複
  const key = (r) => `${r.done_on}|${Math.round(Number(r.duration_min))}|${r.note ?? ''}`
  const have = new Map()
  for (const r of state.exercises) have.set(key(r), (have.get(key(r)) ?? 0) + 1)
  const fresh = preview.value.rows.filter((r) => {
    const n = have.get(key(r)) ?? 0
    if (n > 0) {
      have.set(key(r), n - 1)
      return false
    }
    return true
  })
  importing.value = true
  const ok = await addExercises([...fresh].reverse()) // 記事本新的在上，倒過來插入同一天的先後才對
  importing.value = false
  if (ok) {
    importMsg.value = `匯入 ${fresh.length} 筆，跳過已存在的 ${preview.value.rows.length - fresh.length} 筆。`
    importText.value = ''
  }
}
</script>

<template>
  <div>
    <div class="card">
      <div class="year-nav">
        <button class="btn" aria-label="前一年" @click="year--">‹</button>
        <h2>{{ year }} 年累積</h2>
        <button class="btn" aria-label="下一年" :disabled="year >= thisYear" @click="year++">›</button>
      </div>
      <div class="goal">
        <div class="goal-head">
          <span>目標 <button class="btn link" @click="setGoal">{{ goal }} 小時 ✎</button></span>
          <strong>{{ fmtH(progress.done) }} / {{ goal }}（{{ Math.round(progress.pct) }}%）</strong>
        </div>
        <div class="bar">
          <div class="fill" :style="{ width: progress.pct + '%' }"></div>
          <div v-if="progress.ahead != null" class="mark" :style="{ left: progress.expectedPct + '%' }"></div>
        </div>
        <p v-if="progress.ahead != null" class="note">
          照進度今天該到 {{ fmtH(progress.expected) }} 小時，
          <span :class="progress.ahead >= 0 ? 'good' : 'warn'">
            {{ progress.ahead >= 0 ? '超前' : '落後' }} {{ fmtH(Math.abs(progress.ahead)) }} 小時
          </span>
          <template v-if="progress.remain > 0">；還差 {{ fmtH(progress.remain) }} 小時，每週要 {{ fmtH(progress.perWeek) }} 小時</template>
          <template v-else>；已達標 🎉</template>
        </p>
      </div>
      <div class="stats year-stats">
        <div class="stat">
          <div class="k">次數</div>
          <div class="v">{{ summary.count }}</div>
          <div class="d">去年同期 {{ summary.lastCount }}（{{ diff(summary.count, summary.lastCount) }}）</div>
        </div>
        <div class="stat">
          <div class="k">累計時數</div>
          <div class="v">{{ fmtH(summary.totalH) }} 小時</div>
          <div class="d">去年同期 {{ fmtH(summary.lastH) }}（{{ diff(summary.totalH, summary.lastH, fmtH) }}）</div>
        </div>
        <div class="stat">
          <div class="k">運動天數</div>
          <div class="v">{{ summary.days }}</div>
          <div class="d">一天練兩次算一天</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>記一筆</h2>
      <form class="row" @submit.prevent="submit">
        <div class="field">
          <label>日期</label>
          <input v-model="form.done_on" type="date" required />
        </div>
        <div class="field">
          <label>小時</label>
          <input v-model="form.hours" type="number" step="0.1" min="0" inputmode="decimal" :placeholder="lastHours()" />
        </div>
        <div class="field grow">
          <label>備註．選填</label>
          <input v-model="form.note" type="text" placeholder="籃球、游泳、爬山…" />
        </div>
        <button class="btn primary" :disabled="saving">{{ saving ? '儲存中…' : '儲存' }}</button>
      </form>
      <p class="note" style="margin-top: 10px">
        小時留空就用上一筆的時數。項目會從備註猜（籃球→打球、游泳…），要細改到「運動」分頁。
      </p>
    </div>

    <div class="card">
      <h2>{{ year }} 年記錄</h2>
      <div class="scroll">
        <table class="log">
          <tbody>
            <tr v-for="row in list" :key="row.id">
              <td class="num muted">{{ row.no }}.</td>
              <td>{{ row.done_on.slice(5).replace('-', '') }}</td>
              <td class="num">{{ fmtH(hours(row.duration_min)) }}</td>
              <td>{{ row.note ?? '' }}</td>
              <td class="num"><button class="btn link" @click="remove(row)">刪除</button></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!list.length" class="empty">這年還沒有記錄。</p>
      </div>
    </div>

    <details class="card">
      <summary>從記事本匯入</summary>
      <p class="note">
        直接貼上記事本內容（新的在上面），一行一筆，例如 <code>122. 1004 0.2 羽球課前暖身</code>。
        最上面那筆算 {{ thisYear }} 年，往下月日變大就自動跨到前一年；已經有的會跳過。
      </p>
      <textarea v-model="importText" rows="8" placeholder="124. 1014 0.4&#10;123. 1005 0.4"></textarea>
      <p v-if="preview" class="note">
        可匯入 {{ preview.rows.length }} 筆
        <template v-if="preview.rows.length">
          （{{ preview.rows[preview.rows.length - 1].done_on }} ～ {{ preview.rows[0].done_on }}）
        </template>
        <template v-if="preview.skipped.length">；看不懂、會略過：{{ preview.skipped.join('、') }}</template>
      </p>
      <p v-if="importMsg" class="note">{{ importMsg }}</p>
      <button class="btn primary" :disabled="importing || !preview?.rows.length" @click="runImport">
        {{ importing ? '匯入中…' : '匯入' }}
      </button>
    </details>
  </div>
</template>

<style scoped>
.year-nav { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.year-nav h2 { margin: 0; flex: 1; text-align: center; }
.year-nav .btn { padding: 6px 14px; }
.year-nav .btn:disabled { opacity: 0.35; cursor: default; }
.year-stats { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 560px) {
  .year-stats { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .year-stats .stat { padding: 10px 8px; }
  .year-stats .v { font-size: 18px; }
}
.goal { margin-bottom: 16px; }
.goal-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; }
.goal-head .btn.link { color: var(--accent); }
.bar { position: relative; height: 12px; border-radius: 6px; background: var(--border); margin: 6px 0; }
.fill { height: 100%; border-radius: 6px; background: var(--good); }
.mark { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); }
.good { color: var(--good); }
.warn { color: var(--warn); }
.log { min-width: 0; }
.log td { padding: 5px 8px; }
.muted { color: var(--muted); }
summary { cursor: pointer; font-weight: 600; font-size: 15px; }
textarea {
  width: 100%;
  font: 16px/1.5 ui-monospace, monospace;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: inherit;
  margin-bottom: 8px;
}
</style>
