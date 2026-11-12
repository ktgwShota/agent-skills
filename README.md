# agent-skills

AIエージェント用 skill 置き場

## 構成

カテゴリごとのディレクトリに skill を置く。skill 名は各 SKILL.md の frontmatter `name` で定義する。

| Skill | 説明 |
|---|---|
| [reviewer-comment](./review/reviewer/comment/SKILL.md) | GitHub PR にレビュワーとしてコメントする時の型（ラベル・文面構成・投稿フロー） |
| [reviewee-reply](./review/reviewee/reply/SKILL.md) | GitHub PR で受けたレビューコメントにレビュイーとして返信する時の型（結論4分類・返信フロー） |
| [task-to-pr](./dev/task-to-pr/SKILL.md) | タスクのヒアリングから、テストと実装の並行作成・レビュー・ブラウザ QA を経て Draft PR を出すまで（サブエージェント 5 つを含む） |
| [pr-qa](./qa/pr/SKILL.md) | GitHub PR の実装を検証し、証跡付きの結果を PR にコメントする手順（承認2回・Docker 内のブラウザで録画） |

## インストール

```bash
./install.sh
```

リポジトリ内の全 skill を `~/.claude/skills/` に、skill の `agents/` にあるエージェント定義を `~/.claude/agents/` に symlink する。skill を追加・移動したら再実行する。

Windows の Git Bash では symlink ではなくコピーになる。skill を編集・pull したときも再実行して `~/.claude/skills/` に反映する。

### プラグインとして入れる（task-to-pr）

Docker Sandboxes の中など、`install.sh` を使わない環境ではプラグインとして入れる。

```bash
claude plugin marketplace add ktgwShota/agent-skills
claude plugin install task-to-pr@ktgwshota-agent-skills
```

更新は `claude plugin marketplace update ktgwshota-agent-skills` の後に `claude plugin update task-to-pr@ktgwshota-agent-skills`。

起動は `/task-to-pr:task-to-pr {チケットの URL や説明}`。同じ名前の skill がほかの場所（`~/.claude/skills` や sbx の共有 skill）にもあると、`/task-to-pr` がそちらに解決されることがある。

### Docker Sandboxes（sbx）で使うときの注意

| 項目 | 内容 |
|---|---|
| サンドボックスの作り方 | `sbx create --clone --skills off …`。clone モードならホストのリポジトリを書き換えない。`--skills off` で sbx の共有 skill とプラグインの skill の衝突を避ける |
| デーモン | 権限の制限が無いターミナルから `sbx daemon start --detach` で起動する。Windows では一時フォルダの `sboxd-*`（データの置き場所へのジャンクション）を消さない |
| 言語 | kit が起動のたびに `~/.claude/settings.json` を作り直すので、`claude --settings '{"language":"japanese"}'` のように起動時に渡す |
| 外への通信 | 既定の `balanced` では許可リストに無いホストへの通信が名前解決の失敗として止まる。プロジェクトごとに `sbx policy allow network --sandbox {名前} {ホスト}` を用意する |
| 道具 | QA には Chromium と日本語フォントが要る。Debian 13 のイメージでは Playwright の依存インストールが失敗するので、`apt install chromium fonts-noto-cjk` と `playwright-core` を使う。QA シートには `openpyxl` と `Pillow` が要る |
| 認証 | GitHub は `sbx secret set github` で、対象リポジトリだけに絞った fine-grained token を登録する。中から見えるのは代わりの値だけ |
| `claude -p` で動かす | AskUserQuestion が使えないので、skill は質問を本文に書いてターンを終える。`--resume {セッション ID}` で答えを送る |
