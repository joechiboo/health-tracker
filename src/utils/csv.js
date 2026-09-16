function escape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, columns) {
  const head = columns.map((c) => c.label).join(',')
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(','))
  return [head, ...body].join('\n')
}

export function download(filename, content, type = 'text/csv;charset=utf-8') {
  // Excel 認 BOM 才不會把中文變亂碼
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + content : content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  })
}

export const today = () => new Date().toLocaleDateString('sv-SE') // yyyy-mm-dd（本地時區）
