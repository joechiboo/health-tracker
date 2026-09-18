<script setup>
import { ref, computed, watch } from 'vue'
import { state, saveEntry, deleteEntry } from '../lib/store'
import { toCsv, download, today } from '../utils/csv'

const SPORTS = ['跑步', '快走', '打球', '健身', '騎車', '游泳', '其他']
const DISTANCE_SPORTS = ['跑步', '快走', '騎車', '游泳'] // 其他項目（打球、健身…）沒距離可記
const DEFAULT_EXERCISE = { sport: '跑步', duration_min: 30, distance_km: '' } // 還沒有任何記錄時的起始值

// 運動習慣通常固定，預填上一次的項目與時間，有出入再改
const lastExercise = () => {
  const r = state.exercises[state.exercises.length - 1]
  if (!r) return { ...DEFAULT_EXERCISE }
  return {
    sport: r.sport || DEFAULT_EXERCISE.sport,
    duration_min: r.duration_min == null ? DEFAULT_EXERCISE.duration_min : Number(r.duration_min),
    distance_km: r.distance_km == null ? '' : Number(r.distance_km),
  }
}

const blank = () => ({ done_on: today(), ...lastExercise(), note: '' })

const form = ref(blank())
const saving = ref(false)
const touched = ref(false) // 使用者動過輸入框後就別再覆蓋他打的字

// 資料是 mount 後才載回來的，載到時補上預填值
watch(
  () => state.exercises.length,
  () => {
    if (!touched.value) Object.assign(form.value, lastExercise())
  }
)

// 換成沒距離可記的項目時，把預填帶過來的距離清掉（打球記 2 km 很怪）
watch(
  () => form.value.sport,
  (sport) => {
    if (!DISTANCE_SPORTS.includes(sport)) form.value.distance_km = ''
  }
)

// 配速：分/公里，只有填了距離的項目（跑步、騎車…）才算得出來
function pace(row) {
  if (!row.duration_min || !Number(row.distance_km)) return '—'
  const p = Number(row.duration_min) / Number(row.distance_km)
  const m = Math.floor(p)
  const s = Math.round((p - m) * 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}

async function submit() {
  if (!form.value.done_on || form.value.duration_min === '') return
  saving.value = true
  const ok = await saveEntry('exercises', {
    done_on: form.value.done_on,
    sport: form.value.sport || '其他',
    duration_min: Number(form.value.duration_min),
    distance_km: form.value.distance_km === '' ? null : Number(form.value.distance_km),
    note: form.value.note || null,
  })
  saving.value = false
  if (ok) {
    touched.value = false
    form.value = blank()
  }
}

function edit(row) {
  touched.value = true
  form.value = {
    done_on: row.done_on,
    sport: row.sport ?? '其他',
    duration_min: row.duration_min ?? '',
    distance_km: row.distance_km ?? '',
    note: row.note ?? '',
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function exportCsv() {
  const csv = toCsv([...state.exercises].reverse(), [
    { key: 'done_on', label: '日期' },
    { key: 'sport', label: '項目' },
    { key: 'duration_min', label: '時間(分)' },
    { key: 'distance_km', label: '距離(km)' },
    { key: 'note', label: '備註' },
  ])
  download(`exercises-${today()}.csv`, csv)
}

const desc = computed(() => [...state.exercises].reverse())
const hasDistance = computed(() => DISTANCE_SPORTS.includes(form.value.sport))
const totalMin = computed(() => state.exercises.reduce((a, r) => a + Number(r.duration_min || 0), 0))
const totalHours = computed(() => (totalMin.value / 60).toFixed(1))
</script>

<template>
  <div>
    <div class="card">
      <h2>記一次運動</h2>
      <form class="row" @submit.prevent="submit">
        <div class="field">
          <label>日期</label>
          <input v-model="form.done_on" type="date" required />
        </div>
        <div class="field">
          <label>項目</label>
          <input
            v-model="form.sport"
            list="sport-options"
            type="text"
            required
            placeholder="打球"
            @input="touched = true"
          />
          <datalist id="sport-options">
            <option v-for="s in SPORTS" :key="s" :value="s"></option>
          </datalist>
        </div>
        <div class="field">
          <label>時間 (分)</label>
          <input
            v-model="form.duration_min"
            type="number"
            step="1"
            min="0"
            required
            placeholder="90"
            @input="touched = true"
          />
        </div>
        <div class="field">
          <label>距離 (km)．選填</label>
          <input
            v-model="form.distance_km"
            type="number"
            step="0.1"
            min="0"
            :placeholder="hasDistance ? '2.0' : '這個項目不用填'"
            @input="touched = true"
          />
        </div>
        <div class="field grow">
          <label>備註．選填</label>
          <input v-model="form.note" type="text" placeholder="跟同事打，出很多汗" />
        </div>
        <button class="btn primary" :disabled="saving">{{ saving ? '儲存中…' : '儲存' }}</button>
      </form>
      <p class="note" style="margin-top: 10px">
        沒運動的日子不用記，分析時會自動當 0 分鐘；同一天再存一次會覆蓋原本那筆。
      </p>
    </div>

    <div class="card">
      <div class="toolbar">
        <h2 style="margin: 0">
          運動記錄（{{ state.exercises.length }} 次，累計 {{ totalHours }} 小時）
        </h2>
        <div class="spacer"></div>
        <button class="btn" :disabled="!state.exercises.length" @click="exportCsv">匯出 CSV</button>
      </div>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>項目</th>
              <th class="num">時間 (分)</th>
              <th class="num">距離 (km)</th>
              <th class="num">配速</th>
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in desc" :key="row.done_on">
              <td>{{ row.done_on }}</td>
              <td>{{ row.sport ?? '—' }}</td>
              <td class="num">{{ row.duration_min ?? '—' }}</td>
              <td class="num">{{ row.distance_km == null ? '—' : Number(row.distance_km).toFixed(1) }}</td>
              <td class="num">{{ pace(row) }}</td>
              <td>{{ row.note ?? '' }}</td>
              <td class="num">
                <button class="btn link" @click="edit(row)">編輯</button>
                <button class="btn link" @click="deleteEntry('exercises', row)">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!state.exercises.length" class="empty">還沒有記錄，運動完回來記一筆。</p>
      </div>
    </div>
  </div>
</template>
