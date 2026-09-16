<script setup>
import { computed } from 'vue'
import { state } from '../lib/store'
import { analyze, describeR } from '../utils/stats'

const a = computed(() => analyze(state.weights, state.runs))

const fmtR = (r) => (r === null ? '—' : r.toFixed(2))
const enough = computed(() => a.value.sameDay.n >= 14)

// 把 r 值翻成一句人話
const verdict = computed(() => {
  const { r, n } = a.value.lagged
  if (r === null || n < 14) return '資料還不夠下結論——大概要連續記滿一個月，相關性才開始有意義。'
  if (r < -0.4) return '這段期間跑得多的那幾週，接下來體重確實比較容易往下走。看起來有效。'
  if (r < -0.2) return '跑量多的週次之後體重略有下降，但關係不強——飲食大概是更大的變因。'
  if (r > 0.2) return '跑量多的週次之後體重反而偏高。常見原因是運動後吃更多，或肌肉量上升；別急著下結論。'
  return '目前看不出跑量和後續體重變化有明顯關係。單靠跑步減重本來就慢，繼續記著看趨勢。'
})
</script>

<template>
  <div class="card">
    <h2>概況</h2>
    <div class="stats">
      <div class="stat">
        <div class="k">體重記錄</div>
        <div class="v">{{ a.weightDays }}<span style="font-size: 13px"> 天</span></div>
      </div>
      <div class="stat">
        <div class="k">體重變化</div>
        <div class="v" :class="a.weightDelta === null ? 'muted' : a.weightDelta <= 0 ? 'good' : 'warn'">
          {{ a.weightDelta === null ? '—' : (a.weightDelta > 0 ? '+' : '') + a.weightDelta.toFixed(1) }}
          <span style="font-size: 13px"> kg</span>
        </div>
        <div class="d">從第一筆到最新一筆</div>
      </div>
      <div class="stat">
        <div class="k">跑步天數</div>
        <div class="v">{{ a.runDays }}<span style="font-size: 13px"> 天</span></div>
      </div>
      <div class="stat">
        <div class="k">累計里程</div>
        <div class="v">{{ a.totalKm.toFixed(1) }}<span style="font-size: 13px"> km</span></div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>跑步和體重有關嗎？</h2>
    <div class="stats">
      <div class="stat">
        <div class="k">近 7 日跑量 ↔ 當期體重</div>
        <div class="v" :class="describeR(a.sameDay.r).tone">{{ fmtR(a.sameDay.r) }}</div>
        <div class="d">{{ describeR(a.sameDay.r).label }}．{{ a.sameDay.n }} 個觀測點</div>
      </div>
      <div class="stat">
        <div class="k">近 7 日跑量 ↔ 之後 7 天體重變化</div>
        <div class="v" :class="describeR(a.lagged.r).tone">{{ fmtR(a.lagged.r) }}</div>
        <div class="d">{{ describeR(a.lagged.r).label }}．{{ a.lagged.n }} 個觀測點</div>
      </div>
    </div>

    <p class="note" style="margin-top: 14px">{{ verdict }}</p>

    <p class="note" style="margin-top: 10px">
      相關係數 r 介於 -1 到 1：負值代表「跑越多、體重越低」，正值相反，接近 0 代表看不出關係。
      <br />
      第二個指標比第一個有用——它看的是「這週跑量」對「下週體重」的影響，
      比較接近因果的方向；第一個只是同期比對，長期體重趨勢本身就會把它帶著跑。
      <template v-if="!enough">
        <br /><strong>目前樣本數還少，數字會跳得很厲害，先別當真。</strong>
      </template>
    </p>
    <p class="note">相關不等於因果——飲食、睡眠、工作壓力都沒進這個模型。</p>
  </div>
</template>
