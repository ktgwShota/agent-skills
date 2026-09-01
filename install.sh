#!/usr/bin/env bash
# リポジトリ内の全 skill を ~/.claude/skills/ に symlink する
set -euo pipefail

SKILLS_DIR="${HOME}/.claude/skills"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SKILLS_DIR"

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

  ln -sfn "$skill_dir" "$SKILLS_DIR/$name"
  echo "linked: $SKILLS_DIR/$name -> $skill_dir"
done
