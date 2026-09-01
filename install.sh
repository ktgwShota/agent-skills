#!/usr/bin/env bash
# リポジトリ内の全 skill を ~/.claude/skills/ に symlink する
set -euo pipefail

SKILLS_DIR="${HOME}/.claude/skills"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SKILLS_DIR"

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
