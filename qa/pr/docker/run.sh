#!/usr/bin/env bash
# ホストから QA 用ブラウザのコンテナを動かす（macOS / Linux / Windows の Git Bash）
set -euo pipefail

IMAGE="pr-qa-browser:1"
VOLUME="pr-qa-github-session"
DOCKER_DIR="$(cd "$(dirname "$0")" && pwd)"

# Git Bash がコンテナ内のパスを Windows のパスに書き換えないようにする
export MSYS_NO_PATHCONV=1

abs_dir() { (cd "$1" && pwd); }
host_path() {
  if command -v cygpath > /dev/null; then cygpath -w "$1"; else echo "$1"; fi
}

cmd="${1:-}"
shift || true

case "$cmd" in
  build)
    docker build -t "$IMAGE" "$(host_path "$DOCKER_DIR")"
    ;;
  login)
    echo "ブラウザで http://localhost:6080/vnc.html を開き、表示された画面で GitHub にログインしてください"
    docker run --rm -p 127.0.0.1:6080:6080 --shm-size=1g -v "$VOLUME:/session" "$IMAGE" login
    ;;
  record)
    scenario="$1"
    out_dir="$2"
    mkdir -p "$out_dir"
    scenario_dir="$(abs_dir "$(dirname "$scenario")")"
    docker run --rm --shm-size=1g \
      -v "$(host_path "$scenario_dir"):/in:ro" \
      -v "$(host_path "$(abs_dir "$out_dir")"):/out" \
      "$IMAGE" record "/in/$(basename "$scenario")" /out
    ;;
  shot)
    spec="$1"
    in_dir="$2"
    out_dir="$3"
    mkdir -p "$out_dir"
    docker run --rm --shm-size=1g \
      -v "$(host_path "$(abs_dir "$(dirname "$spec")")"):/spec:ro" \
      -v "$(host_path "$(abs_dir "$in_dir")"):/in:ro" \
      -v "$(host_path "$(abs_dir "$out_dir")"):/out" \
      "$IMAGE" shot "/spec/$(basename "$spec")" /out
    ;;
  upload)
    repo="$1"
    pr="$2"
    files_dir="$3"
    shift 3
    docker run --rm --shm-size=1g \
      -v "$VOLUME:/session" \
      -v "$(host_path "$(abs_dir "$files_dir")"):/files:ro" \
      "$IMAGE" upload "$repo" "$pr" "$@"
    ;;
  *)
    cat >&2 << 'EOF'
usage:
  run.sh build
  run.sh login
  run.sh record <scenario.json> <out_dir>
  run.sh upload <owner/repo> <pr> <files_dir> <file>...
  run.sh shot <spec.json> <in_dir> <out_dir>
EOF
    exit 1
    ;;
esac
