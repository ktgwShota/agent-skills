// noVNC で表示したブラウザで、ユーザーに GitHub へログインしてもらい、セッションを volume に残す
const { chromium } = require('playwright-core')

const PROFILE_DIR = '/session/chromium'
const TIMEOUT_MS = 10 * 60 * 1000
const POLL_MS = 2000

const isLoggedIn = async (context) => {
  const cookies = await context.cookies('https://github.com')
  return cookies.some((c) => c.name === 'logged_in' && c.value === 'yes')
}

const main = async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false, viewport: null, args: ['--start-maximized'] })
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto('https://github.com/login')

  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isLoggedIn(context)) {
      console.log('ログインを確認しました。セッションを保存して終了します')
      await context.close()
      return
    }
    await page.waitForTimeout(POLL_MS)
  }
  await context.close()
  throw new Error('10 分以内にログインが確認できませんでした')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
