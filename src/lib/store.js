import { reactive, computed } from 'vue'
import { supabase, hasSupabase } from './supabase'

// 兩張表共用一套 CRUD，差別只在表名與日期欄位
const TABLES = {
  weights: { table: 'weights', dateKey: 'measured_on' },
  exercises: { table: 'exercises', dateKey: 'done_on' },
}

const LOCAL_PREFIX = 'health-tracker:'

// 舊版離線資料是「晨跑」（runs / ran_on），第一次讀時搬成「運動」（exercises / done_on）
function migrateLocalRuns() {
  if (localStorage.getItem(LOCAL_PREFIX + 'exercises')) return
  const old = localStorage.getItem(LOCAL_PREFIX + 'runs')
  if (!old) return
  try {
    const rows = JSON.parse(old).map((r) => ({
      id: r.id,
      done_on: r.ran_on,
      sport: '跑步',
      duration_min: r.duration_min ?? null,
      distance_km: r.distance_km ?? null,
      note: r.note ?? null,
    }))
    localStorage.setItem(LOCAL_PREFIX + 'exercises', JSON.stringify(rows))
  } catch {
    /* 舊資料壞掉就當沒有，不擋使用 */
  }
}

function readLocal(name) {
  try {
    if (name === 'exercises') migrateLocalRuns()
    return JSON.parse(localStorage.getItem(LOCAL_PREFIX + name) || '[]')
  } catch {
    return []
  }
}

function writeLocal(name, rows) {
  localStorage.setItem(LOCAL_PREFIX + name, JSON.stringify(rows))
}

export const state = reactive({
  weights: [],
  exercises: [],
  loading: false,
  error: '',
  offline: !hasSupabase,
})

export const isOffline = computed(() => state.offline)

async function fetchAll(name) {
  const { table, dateKey } = TABLES[name]
  if (state.offline) {
    return readLocal(name).sort((a, b) => a[dateKey].localeCompare(b[dateKey]))
  }
  const { data, error } = await supabase.from(table).select('*').order(dateKey, { ascending: true })
  if (error) throw error
  return data
}

export async function loadAll() {
  state.loading = true
  state.error = ''
  try {
    const [weights, exercises] = await Promise.all([fetchAll('weights'), fetchAll('exercises')])
    state.weights = weights
    state.exercises = exercises
  } catch (e) {
    state.error = e.message || String(e)
  } finally {
    state.loading = false
  }
}

// 一天一筆：同日期覆蓋（upsert on 日期欄位）
export async function saveEntry(name, row) {
  const { table, dateKey } = TABLES[name]
  state.error = ''
  try {
    if (state.offline) {
      const rows = readLocal(name).filter((r) => r[dateKey] !== row[dateKey])
      rows.push({ ...row, id: Date.now() })
      writeLocal(name, rows)
    } else {
      const { error } = await supabase.from(table).upsert(row, { onConflict: dateKey })
      if (error) throw error
    }
    state[name] = await fetchAll(name)
    return true
  } catch (e) {
    state.error = e.message || String(e)
    return false
  }
}

export async function deleteEntry(name, row) {
  const { table, dateKey } = TABLES[name]
  state.error = ''
  try {
    if (state.offline) {
      writeLocal(name, readLocal(name).filter((r) => r[dateKey] !== row[dateKey]))
    } else {
      const { error } = await supabase.from(table).delete().eq(dateKey, row[dateKey])
      if (error) throw error
    }
    state[name] = await fetchAll(name)
  } catch (e) {
    state.error = e.message || String(e)
  }
}
