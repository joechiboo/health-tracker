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
    return readLocal(name).sort((a, b) => a[dateKey].localeCompare(b[dateKey]) || a.id - b.id)
  }
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(dateKey, { ascending: true })
    .order('id', { ascending: true })
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

// 體重一天一筆：同日期覆蓋（upsert on 日期欄位）
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

// ── 運動：一天可以有多筆（早上跑步、下午加練），用 id 區分 ─────────────

async function runExercises(fn) {
  state.error = ''
  try {
    await fn()
    state.exercises = await fetchAll('exercises')
    return true
  } catch (e) {
    state.error = e.message || String(e)
    return false
  }
}

let localSeq = 0
const localId = () => Date.now() * 1000 + (localSeq++ % 1000)

// 新增一或多筆
export function addExercises(rows) {
  return runExercises(async () => {
    if (!rows.length) return
    if (state.offline) {
      writeLocal('exercises', [...readLocal('exercises'), ...rows.map((r) => ({ ...r, id: localId() }))])
    } else {
      const { error } = await supabase.from('exercises').insert(rows)
      if (error) throw error
    }
  })
}

export function updateExercise(id, row) {
  return runExercises(async () => {
    if (state.offline) {
      writeLocal('exercises', readLocal('exercises').map((r) => (r.id === id ? { ...r, ...row, id } : r)))
    } else {
      const { error } = await supabase.from('exercises').update(row).eq('id', id)
      if (error) throw error
    }
  })
}

export function deleteExercise(id) {
  return runExercises(async () => {
    if (state.offline) {
      writeLocal('exercises', readLocal('exercises').filter((r) => r.id !== id))
    } else {
      const { error } = await supabase.from('exercises').delete().eq('id', id)
      if (error) throw error
    }
  })
}
