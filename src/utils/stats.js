// 體重／跑步的統計工具：都吃 {date, value} 形式的序列

export function pearson(xs, ys) {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? null : num / den
}

export function describeR(r) {
  if (r === null) return { label: '資料不足', tone: 'muted' }
  const a = Math.abs(r)
  const strength = a >= 0.7 ? '強' : a >= 0.4 ? '中等' : a >= 0.2 ? '弱' : '幾乎沒有'
  const dir = r < 0 ? '負' : '正'
  if (a < 0.2) return { label: '幾乎沒有相關', tone: 'muted' }
  return { label: `${strength}${dir}相關`, tone: r < 0 ? 'good' : 'warn' }
}

// 把所有出現過的日期補成連續日曆，方便對齊兩個序列
export function dateRange(dates) {
  if (!dates.length) return []
  const sorted = [...dates].sort()
  const out = []
  const cur = new Date(sorted[0] + 'T00:00:00')
  const end = new Date(sorted[sorted.length - 1] + 'T00:00:00')
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

// 過去 window 天（含當天）的總和；沒跑的日子算 0
export function rollingSum(map, dates, window) {
  return dates.map((_, i) => {
    let sum = 0
    for (let k = Math.max(0, i - window + 1); k <= i; k++) sum += map.get(dates[k]) ?? 0
    return sum
  })
}

// 過去 window 天的移動平均；不足一天資料就跳過（回傳 null）
export function rollingMean(map, dates, window) {
  return dates.map((_, i) => {
    let sum = 0
    let n = 0
    for (let k = Math.max(0, i - window + 1); k <= i; k++) {
      const v = map.get(dates[k])
      if (v != null) {
        sum += v
        n++
      }
    }
    return n ? sum / n : null
  })
}

/**
 * 跑量與體重的關聯分析。
 * weights: [{measured_on, weight_kg}]，runs: [{ran_on, distance_km}]
 */
export function analyze(weights, runs) {
  const wMap = new Map(weights.map((w) => [w.measured_on, Number(w.weight_kg)]))
  const rMap = new Map(runs.map((r) => [r.ran_on, Number(r.distance_km)]))
  const dates = dateRange([...wMap.keys(), ...rMap.keys()])

  const week = rollingSum(rMap, dates, 7)
  const wAvg = rollingMean(wMap, dates, 7)

  // 1) 近 7 天跑量 vs 當日 7 日平均體重
  const xs1 = []
  const ys1 = []
  dates.forEach((d, i) => {
    if (wAvg[i] != null && i >= 6) {
      xs1.push(week[i])
      ys1.push(wAvg[i])
    }
  })

  // 2) 近 7 天跑量 vs 「之後 7 天」的體重變化（跑步是否帶來後續下降）
  const xs2 = []
  const ys2 = []
  dates.forEach((d, i) => {
    const later = i + 7
    if (i >= 6 && later < dates.length && wAvg[i] != null && wAvg[later] != null) {
      xs2.push(week[i])
      ys2.push(wAvg[later] - wAvg[i])
    }
  })

  const totalKm = runs.reduce((a, r) => a + Number(r.distance_km), 0)
  const first = weights[0] ? Number(weights[0].weight_kg) : null
  const last = weights.length ? Number(weights[weights.length - 1].weight_kg) : null

  return {
    dates,
    weeklyKm: week,
    weightAvg: wAvg,
    sameDay: { r: pearson(xs1, ys1), n: xs1.length },
    lagged: { r: pearson(xs2, ys2), n: xs2.length },
    totalKm,
    runDays: runs.length,
    weightDays: weights.length,
    weightDelta: first != null && last != null ? last - first : null,
  }
}
