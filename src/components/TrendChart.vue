<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { state } from '../lib/store'
import { dateRange, rollingMean } from '../utils/stats'
import { today } from '../utils/csv'

// 兩張圖上下並排、共用同一條時間軸；體重與運動時間尺度不同，不共用 y 軸。
const weightCanvas = ref(null)
const exerciseCanvas = ref(null)
const range = ref(90) // 0 = 全部
let weightChart = null
let exerciseChart = null
let mq = null

// dataviz 參考色盤（light / dark 各自選過）
const THEME = {
  light: { weight: '#2a78d6', avg: '#eb6834', exercise: '#1baf7a', surface: '#ffffff', text: '#1c2024', muted: '#6b7280', grid: '#e3e6ea' },
  dark: { weight: '#3987e5', avg: '#d95926', exercise: '#199e70', surface: '#1d2126', text: '#e7eaee', muted: '#9aa3ad', grid: '#2d333b' },
}

const isDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches
const palette = () => (isDark() ? THEME.dark : THEME.light)

const series = computed(() => {
  const wMap = new Map(state.weights.map((w) => [w.measured_on, Number(w.weight_kg)]))
  const eMap = new Map(state.exercises.map((e) => [e.done_on, Number(e.duration_min || 0)]))
  let dates = dateRange([...wMap.keys(), ...eMap.keys()])
  const avgAll = rollingMean(wMap, dates, 7)

  let avg = avgAll
  if (range.value && dates.length > range.value) {
    const cut = dates.length - range.value
    dates = dates.slice(cut)
    avg = avgAll.slice(cut)
  }
  return {
    dates,
    weight: dates.map((d) => wMap.get(d) ?? null),
    avg,
    exercise: dates.map((d) => eMap.get(d) ?? 0),
  }
})

const hasData = computed(() => series.value.dates.length > 0)

function baseOptions(p, yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: p.surface,
        titleColor: p.text,
        bodyColor: p.text,
        borderColor: p.grid,
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { color: p.muted, maxRotation: 0, autoSkipPadding: 24 },
        grid: { display: false },
        border: { color: p.grid },
      },
      y: {
        title: { display: true, text: yLabel, color: p.muted },
        ticks: { color: p.muted },
        grid: { color: p.grid },
        border: { display: false },
        // 固定 y 軸寬度，兩張圖的時間軸才會上下對齊
        afterFit: (scale) => {
          scale.width = 56
        },
      },
    },
  }
}

function render() {
  const p = palette()
  const s = series.value
  weightChart?.destroy()
  exerciseChart?.destroy()
  if (!hasData.value || !weightCanvas.value) return

  const wOpts = baseOptions(p, 'kg')
  wOpts.scales.y.beginAtZero = false
  wOpts.scales.x.ticks.display = false // 日期只在下面那張圖標一次
  wOpts.plugins.legend = {
    display: true,
    position: 'top',
    align: 'end',
    labels: { color: p.muted, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'line' },
  }
  weightChart = new Chart(weightCanvas.value, {
    type: 'line',
    data: {
      labels: s.dates,
      datasets: [
        {
          label: '體重',
          data: s.weight,
          borderColor: p.weight,
          backgroundColor: p.weight,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          spanGaps: true,
          tension: 0.25,
        },
        {
          label: '7 日平均',
          data: s.avg,
          borderColor: p.avg,
          backgroundColor: p.avg,
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true,
          tension: 0.3,
        },
      ],
    },
    options: wOpts,
  })

  const eOpts = baseOptions(p, '分鐘')
  eOpts.scales.y.beginAtZero = true
  exerciseChart = new Chart(exerciseCanvas.value, {
    type: 'bar',
    data: {
      labels: s.dates,
      datasets: [
        {
          label: '當日運動時間',
          data: s.exercise,
          backgroundColor: p.exercise,
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.9,
          categoryPercentage: 0.9,
        },
      ],
    },
    options: eOpts,
  })
}

// 把兩張圖拼成一張 PNG（Chart.js 的 canvas 是透明的，先鋪底色）
function exportPng() {
  if (!weightChart || !exerciseChart) return
  const p = palette()
  const a = weightCanvas.value
  const b = exerciseCanvas.value
  const pad = 24
  const gap = 16
  const headH = 52
  const out = document.createElement('canvas')
  out.width = Math.max(a.width, b.width) + pad * 2
  out.height = headH + a.height + gap + b.height + pad
  const ctx = out.getContext('2d')
  ctx.fillStyle = p.surface
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.fillStyle = p.text
  ctx.font = '600 20px "Noto Sans TC", system-ui, sans-serif'
  ctx.fillText('體重與運動趨勢', pad, 30)
  ctx.fillStyle = p.muted
  ctx.font = '13px "Noto Sans TC", system-ui, sans-serif'
  const s = series.value
  ctx.fillText(`${s.dates[0]} ～ ${s.dates[s.dates.length - 1]}`, pad, 48)
  ctx.drawImage(a, pad, headH)
  ctx.drawImage(b, pad, headH + a.height + gap)
  out.toBlob((blob) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `health-trend-${today()}.png`
    link.click()
    URL.revokeObjectURL(url)
  })
}

onMounted(() => {
  render()
  mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', render)
})

onBeforeUnmount(() => {
  mq?.removeEventListener('change', render)
  weightChart?.destroy()
  exerciseChart?.destroy()
})

watch([series, hasData], () => nextTick(render))
</script>

<template>
  <div class="card">
    <div class="toolbar">
      <h2 style="margin: 0">趨勢折線圖</h2>
      <div class="spacer"></div>
      <select v-model.number="range" class="btn" aria-label="顯示區間">
        <option :value="30">近 30 天</option>
        <option :value="90">近 90 天</option>
        <option :value="0">全部</option>
      </select>
      <button class="btn" :disabled="!hasData" @click="exportPng">匯出 PNG</button>
    </div>

    <p v-if="!hasData" class="empty">先記幾筆體重或運動，這裡就會畫出折線圖。</p>
    <template v-else>
      <div class="chart-wrap"><canvas ref="weightCanvas"></canvas></div>
      <div class="chart-wrap" style="height: 200px; margin-top: 8px">
        <canvas ref="exerciseCanvas"></canvas>
      </div>
      <p class="note" style="margin-top: 10px">
        兩張圖共用同一條時間軸。體重看虛線的 7 日平均比較準——單日體重受水分影響大，
        日線上下 1 公斤是常態。
      </p>
    </template>
  </div>
</template>
