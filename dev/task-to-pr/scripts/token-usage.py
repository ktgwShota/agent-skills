#!/usr/bin/env python3
"""Claude Code の会話記録から、セッションのトークン使用量と金額の目安を集計する。

  token-usage.py --session ID --checkpoint 計画 --progress progress.md   # 累計を進捗ファイルに追記
  token-usage.py --session ID --progress progress.md --markdown          # 役割別・ステップ別の表を出力
"""
import argparse
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# USD / 100 万トークン: (入力, 出力, キャッシュ読み込み)。キャッシュ書き込みは入力の 1.25 倍（5 分）/ 2 倍（1 時間）
PRICES = {
    "claude-fable-5-1": (10.0, 50.0, 0.25),
    "claude-mythos-5-1": (10.0, 50.0, 0.25),
    "claude-fable-5": (10.0, 50.0, 1.0),
    "claude-opus-5-5": (4.0, 20.0, 0.20),
    "claude-opus-5": (5.0, 25.0, 0.50),
    "claude-opus-4-8": (5.0, 25.0, 0.50),
    "claude-opus-4-7": (5.0, 25.0, 0.50),
    "claude-opus-4-6": (5.0, 25.0, 0.50),
    "claude-sonnet-5-5": (2.0, 10.0, 0.20),
    "claude-sonnet-5": (2.0, 10.0, 0.20),
    "claude-sonnet-4-6": (3.0, 15.0, 0.30),
    "claude-haiku-5-5": (0.10, 0.50, 0.01),
    "claude-haiku-4-5": (1.0, 5.0, 0.10),
}
FIELDS = ("input", "cache_write", "cache_read", "output", "usd")
TABLE_HEADER = "| チェックポイント | 時刻 | 入力 | キャッシュ書き込み | キャッシュ読み込み | 出力 | 金額の目安（USD） |"


def price_for(model: str):
    for key, value in PRICES.items():
        if model.startswith(key):
            return value
    return None


def usage_cost(model: str, usage: dict) -> dict:
    creation = usage.get("cache_creation") or {}
    write_5m = creation.get("ephemeral_5m_input_tokens", 0)
    write_1h = creation.get("ephemeral_1h_input_tokens", 0)
    write_total = usage.get("cache_creation_input_tokens", write_5m + write_1h)
    if write_5m + write_1h == 0:
        write_5m = write_total
    row = {
        "input": usage.get("input_tokens", 0),
        "cache_write": write_total,
        "cache_read": usage.get("cache_read_input_tokens", 0),
        "output": usage.get("output_tokens", 0),
        "usd": 0.0,
    }
    price = price_for(model)
    if price:
        p_in, p_out, p_read = price
        row["usd"] = (
            row["input"] * p_in
            + write_5m * p_in * 1.25
            + write_1h * p_in * 2
            + row["cache_read"] * p_read
            + row["output"] * p_out
        ) / 1_000_000
    return row


def read_transcript(path: Path) -> dict:
    """メッセージ ID ごとに最後の usage を残す（1 回の応答が複数行に分かれるため）。"""
    messages = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        message = entry.get("message") or {}
        usage = message.get("usage")
        if entry.get("type") != "assistant" or not usage:
            continue
        key = message.get("id") or entry.get("requestId") or entry.get("uuid")
        messages[key] = (message.get("model", "unknown"), usage)
    return messages


def role_of(meta_path: Path) -> str:
    try:
        agent_type = json.loads(meta_path.read_text(encoding="utf-8")).get("agentType", "")
    except (OSError, json.JSONDecodeError):
        agent_type = ""
    name = agent_type.split(":")[-1]
    return name.removeprefix("task-to-pr-") or "subagent"


def collect(session: str, projects_dir: Path) -> dict:
    totals: dict = defaultdict(lambda: dict.fromkeys(FIELDS, 0))
    for main_file in projects_dir.glob(f"*/{session}.jsonl"):
        sources = [("main", main_file)]
        for sub in sorted((main_file.parent / session / "subagents").glob("agent-*.jsonl")):
            sources.append((role_of(sub.with_name(sub.stem + ".meta.json")), sub))
        for role, path in sources:
            for model, usage in read_transcript(path).values():
                row = usage_cost(model, usage)
                for field in FIELDS:
                    totals[role][field] += row[field]
    return totals


def grand_total(totals: dict) -> dict:
    return {field: sum(row[field] for row in totals.values()) for field in FIELDS}


def append_checkpoint(progress: Path, name: str, total: dict) -> None:
    text = progress.read_text(encoding="utf-8") if progress.exists() else ""
    if TABLE_HEADER not in text:
        text = text.rstrip("\n") + "\n\n" + TABLE_HEADER + "\n|---|---|---|---|---|---|---|\n"
    line = (
        f"| {name} | {datetime.now().strftime('%H:%M')} | {total['input']} | {total['cache_write']} | "
        f"{total['cache_read']} | {total['output']} | {total['usd']:.2f} |\n"
    )
    progress.write_text(text.rstrip("\n") + "\n" + line, encoding="utf-8")


def read_checkpoints(progress: Path) -> list:
    if not progress or not progress.exists():
        return []
    rows = []
    for line in progress.read_text(encoding="utf-8").splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) == 7 and re.fullmatch(r"\d+", cells[2] or ""):
            rows.append((cells[0], [int(c) for c in cells[2:6]] + [float(cells[6])]))
    return rows


def fmt_row(label: str, values) -> str:
    *tokens, usd = values
    return f"| {label} | " + " | ".join(f"{int(v):,}" for v in tokens) + f" | ${usd:.2f} |"


def print_markdown(totals: dict, checkpoints: list) -> None:
    head = "| {} | 入力 | キャッシュ書き込み | キャッシュ読み込み | 出力 | 金額の目安 |\n|---|---|---|---|---|---|"
    print("### 役割ごと\n")
    print(head.format("役割"))
    for role in sorted(totals, key=lambda r: (r != "main", r)):
        print(fmt_row(role, [totals[role][f] for f in FIELDS]))
    print(fmt_row("合計", [grand_total(totals)[f] for f in FIELDS]))
    if checkpoints:
        print("\n### ステップごと（main とサブエージェントの合計）\n")
        print(head.format("ステップ"))
        previous = [0, 0, 0, 0, 0.0]
        for name, values in checkpoints:
            print(fmt_row(name, [v - p for v, p in zip(values, previous)]))
            previous = values
    print("\n金額は API の料金表で換算した目安。サブスクリプションの請求額とは異なる。")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=True)
    parser.add_argument("--projects-dir", default=str(Path.home() / ".claude" / "projects"))
    parser.add_argument("--progress")
    parser.add_argument("--checkpoint")
    parser.add_argument("--markdown", action="store_true")
    args = parser.parse_args()

    totals = collect(args.session, Path(args.projects_dir))
    if not totals:
        print(f"セッション {args.session} の記録が {args.projects_dir} に見つからない")
        return 1
    progress = Path(args.progress) if args.progress else None
    if args.checkpoint:
        if not progress:
            parser.error("--checkpoint には --progress が要る")
        append_checkpoint(progress, args.checkpoint, grand_total(totals))
    if args.markdown:
        print_markdown(totals, read_checkpoints(progress))
    elif not args.checkpoint:
        print(json.dumps({"roles": totals, "total": grand_total(totals)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
