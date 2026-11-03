// コマンドの出力（テキスト）をターミナル風の画像にする。出典と表示した行の範囲を画像に書き込む
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')

const IN_DIR = '/in'
const WIDTH = 960
// 色付きの出力に含まれる制御コード
const ANSI_PATTERN = /\x1b\[[0-9;]*[A-Za-z]/g

const [specPath, outDir] = process.argv.slice(2)
const specs = JSON.parse(fs.readFileSync(specPath, 'utf8'))

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

// range: "all" / "head:N" / "tail:N" / "lines:A-B"（1 始まり）
const selectLines = (lines, range = 'all') => {
  const total = lines.length
  if (range === 'all') return { picked: lines, label: `全 ${total} 行` }
  const [kind, arg] = range.split(':')
  if (kind === 'head') return { picked: lines.slice(0, Number(arg)), label: `先頭 ${arg} 行（全 ${total} 行）` }
  if (kind === 'tail') return { picked: lines.slice(-Number(arg)), label: `末尾 ${arg} 行（全 ${total} 行）` }
  if (kind === 'lines') {
    const [from, to] = arg.split('-').map(Number)
    return { picked: lines.slice(from - 1, to), label: `${from}〜${to} 行目（全 ${total} 行）` }
  }
  throw new Error(`未対応の range: ${range}`)
}

// 1 行目が `$ コマンド` なら、抜粋しても何のコマンドの出力か分かるように先頭に残す
const keepCommandLine = (lines, picked) => {
  const [first] = lines
  if (!first.startsWith('$ ') || picked[0] === first) return picked
  return [first, '…', ...picked]
}

const render = (spec) => {
  const text = fs
    .readFileSync(path.join(IN_DIR, spec.file), 'utf8')
    .replace(ANSI_PATTERN, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n$/, '')
  const lines = text.split('\n')
  const selected = selectLines(lines, spec.range)
  const picked = keepCommandLine(lines, selected.picked)
  const label = picked === selected.picked ? selected.label : `1 行目と${selected.label}`
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#1e1e1e;font-family:"Noto Sans Mono CJK JP","DejaVu Sans Mono",monospace}
.head{background:#2d2d2d;color:#ddd;padding:10px 14px;font:13px/1.5 sans-serif}
.head b{color:#fff;font-size:14px}.src{color:#9aa}
pre{margin:0;padding:12px 14px;color:#e6e6e6;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-all}
</style><div class="head"><b>${escapeHtml(spec.title)}</b><br><span class="src">出典: ${escapeHtml(spec.file)} ／ 表示: ${label}</span></div><pre>${escapeHtml(picked.join('\n'))}</pre>`
}

const main = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 200 } })
  for (const spec of specs) {
    await page.setContent(render(spec))
    await page.screenshot({ path: path.join(outDir, spec.out), fullPage: true })
  }
  await browser.close()
  console.log(JSON.stringify(specs.map((s) => s.out)))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
