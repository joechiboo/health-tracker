<script setup>
import { ref, computed } from 'vue'
import { state, saveEntry, deleteEntry } from '../lib/store'
import { toCsv, download, today } from '../utils/csv'

const form = ref({ ran_on: today(), distance_km: '', duration_min: '', note: '' })
const saving = ref(false)

// 配速：分/公里
function pace(row) {
  if (!row.duration_min || !Number(row.distance_km)) return '—'
  const p = Number(row.duration_min) / Number(row.distance_km)
  const m = Math.floor(p)
  const s = Math.round((p - m) * 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}

async function submit() {
  if (!form.value.ran_on || form.value.distance_km === '') return
  saving.value = true
  const ok = await saveEntry('runs', {
    ran_on: form.value.ran_on,
    distance_km: Number(form.value.distance_km),
    duration_min: form.value.duration_min === '' ? null : Number(form.value.duration_min),
    note: form.value.note || null,
  })
  saving.value = false
  if (ok) form.value = { ran_on: today(), distance_km: '', duration_min: '', note: '' }
}

function edit(row) {
  form.value = {
    ran_on: row.ran_on,
    distance_km: row.distance_km,
    duration_min: row.duration_min ?? '',
    note: row.note ?? '',
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function exportCsv() {
  const csv = toCsv([...state.runs].reverse(), [
    { key: 'ran_on', label: '日期' },
    { key: 'distance_km', label: '距離(km)' },
    { key: 'duration_min', label: '時間(分)' },
    { key: 'note', label: '備註' },
  ])
  download(`runs-${today()}.csv`, csv)
}

const desc = computed(() => [...state.runs].reverse())
const totalKm = computed(() => state.runs.reduce((a, r) => a + Number(r.distance_km), 0))
</script>

<template>
  <div>
    <div class="card">
      <h2>記一次晨跑</h2>
      <form class="row" @submit.prevent="submit">
        <div class="field">
          <label>日期</label>
          <input v-model="form.ran_on" type="date" required />
        </div>
        <div class="field">
          <label>距離 (km)</label>
          <input v-model="form.distance_km" type="number" step="0.1" min="0" required placeholder="5.0" />
        </div>
        <div class="field">
          <label>時間 (分)．選填</label>
          <input v-model="form.duration_min" type="number" step="0.5" min="0" placeholder="32" />
        </div>
        <div class="field grow">
          <label>備註．選填</label>
          <input v-model="form.note" type="text" placeholder="河濱、天氣涼" />
        </div>
        <button class="btn primary" :disabled="saving">{{ saving ? '儲存中…' : '儲存' }}</button>
      </form>
      <p class="note" style="margin-top: 10px">沒跑的日子不用記，分析時會自動當 0 公里。</p>
    </div>

    <div class="card">
      <div class="toolbar">
        <h2 style="margin: 0">晨跑記錄（{{ state.runs.length }} 次，累計 {{ totalKm.toFixed(1) }} km）</h2>
        <div class="spacer"></div>
        <button class="btn" :disabled="!state.runs.length" @click="exportCsv">匯出 CSV</button>
      </div>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th class="num">距離 (km)</th>
              <th class="num">時間 (分)</th>
              <th class="num">配速</th>
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in desc" :key="row.ran_on">
              <td>{{ row.ran_on }}</td>
              <td class="num">{{ Number(row.distance_km).toFixed(1) }}</td>
              <td class="num">{{ row.duration_min ?? '—' }}</td>
              <td class="num">{{ pace(row) }}</td>
              <td>{{ row.note ?? '' }}</td>
              <td class="num">
                <button class="btn link" @click="edit(row)">編輯</button>
                <button class="btn link" @click="deleteEntry('runs', row)">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!state.runs.length" class="empty">還沒有記錄，明天早上跑完回來記一筆。</p>
      </div>
    </div>
  </div>
</template>
