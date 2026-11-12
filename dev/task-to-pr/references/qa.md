# QA シナリオと QA シート

## QA シナリオ（planner が計画に書く）

ブラウザで操作して確かめられる完了要件ごとに 1 つ。

| 項目 | 内容 |
|---|---|
| 要件 | `[R1]` など |
| 開く URL | 開発サーバーからの相対パス |
| 操作 | 入力・クリックなどを順に |
| 期待結果 | 画面に何が出るか |
| 変更前も撮るか | バグ修正・見た目の変更なら撮る |

## スクショ（qa が撮る）

`node "${CLAUDE_SKILL_DIR}/scripts/shoot.mjs" {シナリオの JSON} {出力先}` で撮る。

```json
{
  "baseUrl": "http://localhost:5173",
  "viewport": { "width": 1280, "height": 800 },
  "steps": [
    { "goto": "/" },
    { "fill": { "selector": "input[name=email]", "value": "taro" } },
    { "click": "button[type=submit]" },
    { "wait": 300 },
    { "screenshot": "R1-after" },
    { "text": { "selector": "[data-error-for=email]", "name": "R1-email-error" } }
  ]
}
```

- `screenshot` は `{出力先}/{名前}.png` に保存する
- `text` は要素の文字を `{出力先}/{名前}.txt` に保存する。期待結果との照合に使う
- `playwright-core` と Chromium を使う。Chromium は環境変数 `CHROMIUM_PATH`、`/usr/bin/chromium`、Playwright 同梱の順に探す

## QA シート（qa が作る）

`python3 "${CLAUDE_SKILL_DIR}/scripts/qa-sheet.py" {行の JSON} {出力先の xlsx}` で作る。`openpyxl` と `Pillow` が要る。

```json
[
  {
    "requirement": "[R1] メールアドレスが空なら…",
    "steps": "1. / を開く\n2. メールアドレスを空のまま登録するを押す",
    "expected": "『メールアドレスを入力してください』と表示される",
    "result": "OK",
    "actual": "『メールアドレスを入力してください』と表示された",
    "before": "qa/before/R1.png",
    "after": "qa/after/R1.png"
  }
]
```

列は「完了要件・手順・期待結果・結果・実際の結果・変更前・変更後」。画像のパスは JSON のある場所からの相対パスか絶対パス。
