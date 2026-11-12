#!/usr/bin/env node
// シナリオの JSON どおりにブラウザを操作し、スクショと要素の文字を保存する。
//   node shoot.mjs scenario.json out-dir
// playwright-core はカレントディレクトリ、この skill の scripts、グローバルの順に探す。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const [scenarioPath, outDir] = process.argv.slice(2)
if (!scenarioPath || !outDir) {
  console.error('usage: node shoot.mjs scenario.json out-dir')
  process.exit(2)
}

function loadPlaywright() {
  const bases = [process.cwd(), import.meta.dirname, '/usr/local/lib/node_modules', '/usr/lib/node_modules']
  for (const base of bases) {
    for (const name of ['playwright-core', 'playwright']) {
      try {
        return createRequire(join(base, 'noop.js'))(name)
      } catch {}
    }
  }
  console.error('playwright-core が見つからない。npm i playwright-core で入れる')
  process.exit(3)
}

function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
  return candidates.find((p) => p && existsSync(p))
}

const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'))
const { chromium } = loadPlaywright()
mkdirSync(outDir, { recursive: true })

const executablePath = chromiumPath()
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const page = await browser.newPage({ viewport: scenario.viewport ?? { width: 1280, height: 800 } })
const results = []

try {
  for (const step of scenario.steps) {
    if (step.goto) await page.goto(new URL(step.goto, scenario.baseUrl).href, { waitUntil: 'networkidle' })
    else if (step.fill) await page.fill(step.fill.selector, step.fill.value)
    else if (step.click) await page.click(step.click)
    else if (step.press) await page.press(step.press.selector, step.press.key)
    else if (step.wait) await page.waitForTimeout(step.wait)
    else if (step.screenshot) {
      const file = resolve(outDir, `${step.screenshot}.png`)
      await page.screenshot({ path: file, fullPage: true })
      results.push({ screenshot: file })
    } else if (step.text) {
      const value = (await page.textContent(step.text.selector)) ?? ''
      const file = resolve(outDir, `${step.text.name}.txt`)
      writeFileSync(file, value)
      results.push({ text: step.text.name, value })
    } else throw new Error(`知らない操作: ${JSON.stringify(step)}`)
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(results, null, 2))
