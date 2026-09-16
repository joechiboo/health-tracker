import { reactive, computed } from 'vue'
import { supabase, hasSupabase } from './supabase'

// 兩張表共用一套 CRUD，差別只在表名與日期欄位
const TABLES = {
  weights: { table: 'weights', dateKey: 'measured_on' },
  runs: { table: 'runs', dateKey: 'ran_on' },
}

const LOCAL_PREFIX = 'health-tracker:'

function readLocal(name) {
  try {
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
  runs: [],
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
    const [weights, runs] = await Promise.all([fetchAll('weights'), fetchAll('runs')])
    state.weights = weights
    state.runs = runs
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
