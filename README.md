# agent-skills

AIエージェント用 skill 置き場

## Skills

| Skill | 説明 |
|---|---|
| [review-comment](./review-comment/SKILL.md) | GitHub PR にレビュワーとしてコメントする時の型（ラベル・文面構成・投稿フロー） |

## 使い方

Claude Code で使う場合は、skill のディレクトリを `~/.claude/skills/` 以下にコピーまたはシンボリックリンクする。

```bash
ln -s /path/to/agent-skills/review-comment ~/.claude/skills/review-comment
```
