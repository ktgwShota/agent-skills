// シナリオに沿ってページを操作し、動画・スクショ・通信・コンソールを記録する
const fs = require('node:fs')
const path = require('node:path')
const { chromium, devices } = require('playwright-core')

const POST_DATA_LIMIT = 4000
const OVERLAY_MS = 5000

const [scenarioPath, outDir] = process.argv.slice(2)
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))

const resolveProfile = (profile) => {
  const base = profile.device ? devices[profile.device] : {}
  if (profile.device && !base) throw new Error(`device が見つからない: ${profile.device}`)
  return { ...base, ...(profile.viewport ? { viewport: profile.viewport } : {}) }
}

const isTracked = (url) => !scenario.trackUrls?.length || scenario.trackUrls.some((t) => url.includes(t))

const runStep = async (page, step, profileDir) => {
  if (step.goto) return page.goto(step.goto, { waitUntil: 'load' })
  if (step.back) return page.goBack({ waitUntil: 'load' })
  if (step.wait) return page.waitForTimeout(step.wait)
  if (step.scroll) return page.mouse.wheel(0, step.scroll)
  if (step.click) return page.click(step.click)
  if (step.fill) return page.fill(step.fill.selector, step.fill.value)
  if (step.screenshot) return page.screenshot({ path: path.join(profileDir, `${step.screenshot}.png`), fullPage: !!step.fullPage })
  throw new Error(`未対応の step: ${JSON.stringify(step)}`)
}

const showOverlay = async (page, requests) => {
  const rows = requests.map((r) => `${r.method} ${r.status}  ${r.url.split('?')[0]}`)
  await page.evaluate((lines) => {
    const panel = document.createElement('div')
    panel.style.cssText =
      'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:rgba(255,255,255,.96);color:#111;font:12px/1.5 monospace;padding:10px;border:2px solid #1f5fae;border-radius:6px;word-break:break-all'
    panel.innerHTML = `<b>QA 記録（Playwright が重ねて表示）通信</b><br>${lines.join('<br>')}`
    document.body.appendChild(panel)
  }, rows)
  await page.waitForTimeout(OVERLAY_MS)
}

const runProfile = async (browser, profile) => {
  const profileDir = path.join(outDir, profile.name)
  fs.mkdirSync(profileDir, { recursive: true })
  const options = resolveProfile(profile)
  const context = await browser.newContext({ ...options, recordVideo: { dir: profileDir, size: options.viewport } })
  const page = await context.newPage()
  const requests = []
  const consoleLines = []

  page.on('requestfinished', async (req) => {
    if (!isTracked(req.url())) return
    const res = await req.response()
    requests.push({ method: req.method(), url: req.url(), status: res?.status() ?? null, postData: (req.postData() || '').slice(0, POST_DATA_LIMIT) })
  })
  page.on('requestfailed', (req) => {
    if (!isTracked(req.url())) return
    requests.push({ method: req.method(), url: req.url(), status: 'FAILED', error: req.failure()?.errorText })
  })
  page.on('response', (res) => {
    if (res.status() >= 400) consoleLines.push(`[http ${res.status()}] ${res.url()}`)
  })
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err.message}`))

  await page.goto(scenario.url, { waitUntil: 'load' })
  for (const step of scenario.steps || []) await runStep(page, step, profileDir)
  if (scenario.overlay) await showOverlay(page, requests)

  const video = page.video()
  await context.close()
  if (video) fs.renameSync(await video.path(), path.join(profileDir, 'video.webm'))
  fs.writeFileSync(path.join(profileDir, 'network.json'), JSON.stringify(requests, null, 2))
  fs.writeFileSync(path.join(profileDir, 'console.json'), JSON.stringify(consoleLines, null, 2))
  return { profile: profile.name, requests: requests.length, console: consoleLines.length }
}

const main = async () => {
  // ホストで動く開発環境（localhost:xxxx）を、URL を変えずにコンテナのブラウザから開く
  const args = scenario.localhostToHost ? ['--host-resolver-rules=MAP localhost host.docker.internal'] : []
  const browser = await chromium.launch({ args })
  const summary = []
  for (const profile of scenario.profiles) summary.push(await runProfile(browser, profile))
  await browser.close()
  console.log(JSON.stringify(summary))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
