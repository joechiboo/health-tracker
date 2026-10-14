// 解析記事本格式的運動流水帳，一行一筆：
//   124. 1014 0.4
//   122. 1004 0.2 羽球課前暖身
//   18. 0807 公設 3
// 編號可有可無；第一個純數字是「小時」，其他字當備註。
// 記事本是新的在上面，所以由上往下讀、月日突然變大就代表跨到前一年。

const SPORT_KEYWORDS = [
  [/籃球|羽球|匹克球|打球|網球|排球/, '打球'],
  [/游泳|泳/, '游泳'],
  [/爬山|縱走|外木山|登山/, '爬山'],
  [/腳踏車|bike|騎車/i, '騎車'],
  [/gym|健身|重訓/i, '健身'],
  [/慢跑|跑|間歇/, '跑步'],
]

export function guessSport(note) {
  if (!note) return '其他'
  for (const [re, sport] of SPORT_KEYWORDS) if (re.test(note)) return sport
  return '其他'
}

export function parseNotepad(text, startYear) {
  const rows = []
  const skipped = []
  let year = startYear
  let prev = null // 上一筆的 MMDD，用來判斷跨年

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^[-=]{2,}/.test(line)) continue // 年份分隔線之類

    const m = line.match(/^(?:\d+\.\s*)?(\d{4})\s+(.*)$/)
    if (!m) {
      skipped.push(line)
      continue
    }
    const [, mmdd, rest] = m
    const month = Number(mmdd.slice(0, 2))
    const day = Number(mmdd.slice(2))
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      skipped.push(line)
      continue
    }

    const tokens = rest.split(/\s+/)
    const idx = tokens.findIndex((t) => /^\d+(\.\d+)?$/.test(t))
    if (idx < 0) {
      skipped.push(line)
      continue
    }
    const hours = Number(tokens[idx])
    const note = tokens.filter((_, i) => i !== idx).join(' ').trim() || null

    if (prev != null && mmdd > prev) year--
    prev = mmdd

    rows.push({
      done_on: `${year}-${mmdd.slice(0, 2)}-${mmdd.slice(2)}`,
      sport: guessSport(note),
      duration_min: Math.round(hours * 60),
      distance_km: null,
      note,
    })
  }
  return { rows, skipped }
}
