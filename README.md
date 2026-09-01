# agent-skills

AIエージェント用 skill 置き場

## 構成

カテゴリごとのディレクトリに skill を置く。skill 名は各 SKILL.md の frontmatter `name` で定義する。

| Skill | 説明 |
|---|---|
| [review-comment](./review/comment/SKILL.md) | GitHub PR にレビュワーとしてコメントする時の型（ラベル・文面構成・投稿フロー） |
| [review-reply](./review/reply/SKILL.md) | GitHub PR のレビューコメントにレビュイーとして返信する時の型（結論4分類・返信フロー） |

## インストール

```bash
./install.sh
```

リポジトリ内の全 skill を `~/.claude/skills/` に symlink する。skill を追加・移動したら再実行する。
