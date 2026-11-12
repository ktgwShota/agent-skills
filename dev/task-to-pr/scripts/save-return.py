#!/usr/bin/env python3
"""サブエージェントの最後の返答を、会話記録から原文のまま書き出す。

  save-return.py --session ID --agent エージェントID --out returns/planner-1.md
  save-return.py --session ID --role planner --out returns/planner-1.md   # その役割で最も新しいもの
"""
import argparse
import json
from pathlib import Path


def read_entries(path: Path):
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def subagent_files(session: str, projects_dir: Path) -> list:
    files = []
    for main_file in projects_dir.glob(f"*/{session}.jsonl"):
        files.extend((main_file.parent / session / "subagents").glob("agent-*.jsonl"))
    return files


def agent_type(path: Path) -> str:
    meta = path.with_suffix(".meta.json")
    if not meta.exists():
        return ""
    return json.loads(meta.read_text(encoding="utf-8")).get("agentType", "")


def find_transcript(session: str, projects_dir: Path, agent: str, role: str):
    files = subagent_files(session, projects_dir)
    if agent:
        files = [f for f in files if f.stem == f"agent-{agent}"]
    else:
        files = [f for f in files if agent_type(f).endswith(f"task-to-pr-{role}")]
    return max(files, key=lambda f: f.stat().st_mtime, default=None)


def last_reply(path: Path) -> str:
    messages = {}
    order = []
    for entry in read_entries(path):
        message = entry.get("message") or {}
        if message.get("role") != "assistant":
            continue
        texts = [c["text"] for c in message.get("content") or [] if c.get("type") == "text"]
        if not texts:
            continue
        key = message.get("id") or entry.get("uuid")
        if key not in messages:
            messages[key] = []
            order.append(key)
        messages[key].extend(texts)
    return "\n\n".join(messages[order[-1]]) if order else ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=True)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--agent", help="エージェント ID（agent-{ID}.jsonl の ID）")
    target.add_argument("--role", help="planner・test-writer・implementer・reviewer・qa")
    parser.add_argument("--out", required=True)
    parser.add_argument("--projects-dir", default=str(Path.home() / ".claude" / "projects"))
    args = parser.parse_args()

    path = find_transcript(args.session, Path(args.projects_dir), args.agent, args.role)
    if path is None:
        print(f"セッション {args.session} に、該当するサブエージェントの記録が見つからない")
        return 1
    reply = last_reply(path)
    if not reply:
        print(f"{path} に返答の文章が無い")
        return 1
    out = Path(args.out)
    if out.exists():
        print(f"{out} は既にある。番号を変えて保存する")
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(reply + "\n", encoding="utf-8")
    print(f"{path.name} の返答を {out} に保存した（{len(reply)} 文字）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
