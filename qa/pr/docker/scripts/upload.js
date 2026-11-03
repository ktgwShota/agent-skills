// PR のコメント欄にファイルを添付してアップロードし、GitHub が返した Markdown と URL を出力する
// コメントの投稿はしない（入力欄は最後に空にする）。投稿はホストの gh で行う
const path = require('node:path')
const { chromium } = require('playwright-core')

const PROFILE_DIR = '/session/chromium'
const FILES_DIR = '/files'
const UPLOAD_TIMEOUT_MS = 180 * 1000
const POLL_MS = 500
const UPLOADING_PATTERN = /\[Uploading [^\]]*\]\(\)/
const COMMENT_FIELD_SELECTORS = ['#new_comment_field', 'textarea[name="comment[body]"]']
const ASSET_URL_PATTERN = /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/
// 失敗したファイルがあったことを、呼び出し側が終了コードで分かるようにする
const EXIT_PARTIAL_FAILURE = 3

const [repo, pr, ...files] = process.argv.slice(2)

const findCommentField = async (page) => {
  for (const selector of COMMENT_FIELD_SELECTORS) {
    const field = page.locator(selector).first()
    if ((await field.count()) > 0) return field
  }
  throw new Error('コメント欄が見つからない（GitHub の画面構成が変わった可能性がある）')
}

// GitHub の CSP がページ内での関数評価を拒否するため、入力欄の値は Node 側から定期的に読む
const waitForUploaded = async (page, field, before) => {
  const deadline = Date.now() + UPLOAD_TIMEOUT_MS
  while (Date.now() < deadline) {
    const value = await field.inputValue()
    if (value !== before && !UPLOADING_PATTERN.test(value)) return value
    await page.waitForTimeout(POLL_MS)
  }
  throw new Error('アップロードが時間内に終わらなかった')
}

const uploadOne = async (page, field, fileInput, file) => {
  const before = await field.inputValue()
  await fileInput.setInputFiles(path.join(FILES_DIR, file))
  const after = await waitForUploaded(page, field, before)
  return after.slice(before.length).trim()
}

const main = async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true })
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto(`https://github.com/${repo}/pull/${pr}`, { waitUntil: 'domcontentloaded' })

  const cookies = await context.cookies('https://github.com')
  if (!cookies.some((c) => c.name === 'logged_in' && c.value === 'yes')) {
    await context.close()
    console.error('GitHub に未ログイン。run.sh login でログインしてから再実行する')
    process.exit(2)
  }

  const field = await findCommentField(page)
  // 前回の実行で残った下書きを消してから始める
  await field.fill('')
  const fileInput = field.locator('xpath=ancestor::form').locator('input[type="file"]').first()
  const results = []
  for (const [index, file] of files.entries()) {
    console.error(`[${index + 1}/${files.length}] ${file}`)
    try {
      const markdown = await uploadOne(page, field, fileInput, file)
      results.push({ file, markdown, url: (markdown.match(ASSET_URL_PATTERN) || [])[0] ?? null })
    } catch (err) {
      results.push({ file, error: err.message, fieldValue: (await field.inputValue()).slice(-300) })
      await field.fill('')
    }
  }
  await field.fill('')
  await context.close()
  console.log(JSON.stringify(results, null, 2))
  if (results.some((r) => r.error)) process.exitCode = EXIT_PARTIAL_FAILURE
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
