<script setup>
import { ref } from 'vue'
import { state, saveEntry, deleteEntry } from '../lib/store'
import { toCsv, download, today } from '../utils/csv'

const form = ref({ measured_on: today(), weight_kg: '', body_fat: '', note: '' })
const saving = ref(false)

async function submit() {
  if (!form.value.measured_on || !form.value.weight_kg) return
  saving.value = true
  const ok = await saveEntry('weights', {
    measured_on: form.value.measured_on,
    weight_kg: Number(form.value.weight_kg),
    body_fat: form.value.body_fat === '' ? null : Number(form.value.body_fat),
    note: form.value.note || null,
  })
  saving.value = false
  if (ok) form.value = { measured_on: today(), weight_kg: '', body_fat: '', note: '' }
}

function edit(row) {
  form.value = {
    measured_on: row.measured_on,
    weight_kg: row.weight_kg,
    body_fat: row.body_fat ?? '',
    note: row.note ?? '',
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function exportCsv() {
  const csv = toCsv([...state.weights].reverse(), [
    { key: 'measured_on', label: '日期' },
    { key: 'weight_kg', label: '體重(kg)' },
    { key: 'body_fat', label: '體脂(%)' },
    { key: 'note', label: '備註' },
  ])
  download(`weights-${today()}.csv`, csv)
}

const desc = () => [...state.weights].reverse()
</script>

<template>
  <div>
    <div class="card">
      <h2>記一筆體重</h2>
      <form class="row" @submit.prevent="submit">
        <div class="field">
          <label>日期</label>
          <input v-model="form.measured_on" type="date" required />
        </div>
        <div class="field">
          <label>體重 (kg)</label>
          <input v-model="form.weight_kg" type="number" step="0.1" min="0" required placeholder="68.5" />
        </div>
        <div class="field">
          <label>體脂 (%)．選填</label>
          <input v-model="form.body_fat" type="number" step="0.1" min="0" placeholder="18.2" />
        </div>
        <div class="field grow">
          <label>備註．選填</label>
          <input v-model="form.note" type="text" placeholder="早上空腹" />
        </div>
        <button class="btn primary" :disabled="saving">{{ saving ? '儲存中…' : '儲存' }}</button>
      </form>
      <p class="note" style="margin-top: 10px">同一天再存一次會覆蓋原本那筆。</p>
    </div>

    <div class="card">
      <div class="toolbar">
        <h2 style="margin: 0">體重記錄（{{ state.weights.length }} 筆）</h2>
        <div class="spacer"></div>
        <button class="btn" :disabled="!state.weights.length" @click="exportCsv">匯出 CSV</button>
      </div>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th class="num">體重 (kg)</th>
              <th class="num">體脂 (%)</th>
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in desc()" :key="row.measured_on">
              <td>{{ row.measured_on }}</td>
              <td class="num">{{ Number(row.weight_kg).toFixed(1) }}</td>
              <td class="num">{{ row.body_fat ?? '—' }}</td>
              <td>{{ row.note ?? '' }}</td>
              <td class="num">
                <button class="btn link" @click="edit(row)">編輯</button>
                <button class="btn link" @click="deleteEntry('weights', row)">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!state.weights.length" class="empty">還沒有記錄，從上面新增第一筆吧。</p>
      </div>
    </div>
  </div>
</template>
