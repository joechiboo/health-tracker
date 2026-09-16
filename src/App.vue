<script setup>
import { ref, onMounted } from 'vue'
import { state, loadAll } from './lib/store'
import WeightSheet from './components/WeightSheet.vue'
import RunSheet from './components/RunSheet.vue'
import TrendChart from './components/TrendChart.vue'
import AnalysisPanel from './components/AnalysisPanel.vue'

const tab = ref('weight')
const tabs = [
  { key: 'weight', label: '體重' },
  { key: 'run', label: '晨跑' },
  { key: 'trend', label: '趨勢圖' },
  { key: 'analysis', label: '相關性' },
]

onMounted(loadAll)
</script>

<template>
  <div class="app">
    <header>
      <h1>Health Tracker</h1>
      <p>每天量一次體重、記一次晨跑，看看兩者到底有沒有關係。</p>
    </header>

    <div v-if="state.offline" class="banner">
      目前是<strong>離線模式</strong>：資料存在這台瀏覽器的 localStorage。
      設定 <code>.env</code> 的 <code>VITE_SUPABASE_URL</code> 與
      <code>VITE_SUPABASE_ANON_KEY</code> 後重開 dev server，就會改存到 Supabase。
    </div>
    <div v-if="state.error" class="banner error">{{ state.error }}</div>

    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <p v-if="state.loading" class="empty">載入中…</p>

    <WeightSheet v-show="tab === 'weight'" />
    <RunSheet v-show="tab === 'run'" />
    <TrendChart v-if="tab === 'trend'" />
    <AnalysisPanel v-if="tab === 'analysis'" />
  </div>
</template>
