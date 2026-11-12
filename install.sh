#!/usr/bin/env bash
# リポジトリ内の全 skill を ~/.claude/skills/ に、skill に付属するエージェント定義を ~/.claude/agents/ に symlink する
set -euo pipefail

SKILLS_DIR="${HOME}/.claude/skills"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

AGENTS_DIR="${HOME}/.claude/agents"

mkdir -p "$SKILLS_DIR" "$AGENTS_DIR"

# このリポジトリを指すリンク切れ symlink を掃除する（skill の移動・改名対応）
for link in "$SKILLS_DIR"/*; do
  [ -L "$link" ] || continue
  target="$(readlink "$link")"
  case "$target" in
    "$REPO_DIR"/*)
      if [ ! -e "$target" ]; then
        rm "$link"
        echo "removed: $link (リンク切れ)"
      fi
      ;;
  esac
done

find "$REPO_DIR" -name SKILL.md -not -path '*/.git/*' | while read -r skill_file; do
  skill_dir="$(dirname "$skill_file")"
  name="$(sed -n 's/^name:[[:space:]]*//p' "$skill_file" | head -n1)"

  if [ -z "$name" ]; then
    echo "skip: frontmatter に name がありません: $skill_file" >&2
    continue
  fi

  # Windows の Git Bash では ln -s がコピーになり、再実行すると既存のコピーの中に入れ子で作られる。
  # 前回このスクリプトが作ったコピー（同じ name の SKILL.md を持つディレクトリ）は消してから作り直す
  dest="${SKILLS_DIR:?}/${name:?}"
  if [ -d "$dest" ] && [ ! -L "$dest" ] && grep -q "^name:[[:space:]]*${name}[[:space:]]*$" "$dest/SKILL.md" 2> /dev/null; then
    rm -rf "$dest"
  fi

  ln -sfn "$skill_dir" "$dest"
  echo "linked: $dest -> $skill_dir"
done

# skill のディレクトリの agents/*.md を、frontmatter の name でエージェント定義として link する
find "$REPO_DIR" -path '*/agents/*.md' -not -path '*/.git/*' | while read -r agent_file; do
  name="$(sed -n 's/^name:[[:space:]]*//p' "$agent_file" | head -n1)"
  [ -n "$name" ] || continue
  ln -sfn "$agent_file" "$AGENTS_DIR/$name.md"
  echo "linked: $AGENTS_DIR/$name.md -> $agent_file"
done
