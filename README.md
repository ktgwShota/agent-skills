# agent-skills

AIエージェント用 skill 置き場

## 構成

カテゴリごとのディレクトリに skill を置く。skill 名は各 SKILL.md の frontmatter `name` で定義する。

| Skill | 説明 |
|---|---|
| [reviewer-comment](./review/reviewer/comment/SKILL.md) | GitHub PR にレビュワーとしてコメントする時の型（ラベル・文面構成・投稿フロー） |
| [reviewee-reply](./review/reviewee/reply/SKILL.md) | GitHub PR で受けたレビューコメントにレビュイーとして返信する時の型（結論4分類・返信フロー） |
| [pr-qa](./qa/pr/SKILL.md) | GitHub PR の実装を検証し、証跡付きの結果を PR にコメントする手順（承認2回・Docker 内のブラウザで録画） |

## インストール

```bash
./install.sh
```

リポジトリ内の全 skill を `~/.claude/skills/` に symlink する。skill を追加・移動したら再実行する。

Windows の Git Bash では symlink ではなくコピーになる。skill を編集・pull したときも再実行して `~/.claude/skills/` に反映する。
