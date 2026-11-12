#!/usr/bin/env python3
"""QA の結果を、スクショを貼った Excel のシートにする。

  qa-sheet.py rows.json qa-sheet.xlsx
"""
import json
import sys
from pathlib import Path

try:
    from openpyxl import Workbook
    from openpyxl.drawing.image import Image
    from openpyxl.styles import Alignment, Font, PatternFill
except ImportError:
    sys.exit("openpyxl が無い。pip install openpyxl pillow で入れる")

COLUMNS = [
    ("完了要件", "requirement", 30),
    ("手順", "steps", 36),
    ("期待結果", "expected", 30),
    ("結果", "result", 8),
    ("実際の結果", "actual", 30),
    ("変更前", "before", 48),
    ("変更後", "after", 48),
]
IMAGE_WIDTH = 320
RESULT_FILLS = {"OK": "D9EAD3", "NG": "F4CCCC"}


def add_image(sheet, cell: str, path: Path) -> int:
    image = Image(str(path))
    scale = IMAGE_WIDTH / image.width
    image.width = IMAGE_WIDTH
    image.height = int(image.height * scale)
    sheet.add_image(image, cell)
    return image.height


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    rows_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    rows = json.loads(rows_path.read_text(encoding="utf-8"))

    book = Workbook()
    sheet = book.active
    sheet.title = "QA"
    for index, (title, _, width) in enumerate(COLUMNS, start=1):
        cell = sheet.cell(row=1, column=index, value=title)
        cell.font = Font(bold=True)
        sheet.column_dimensions[cell.column_letter].width = width

    for row_number, row in enumerate(rows, start=2):
        image_height = 0
        for index, (_, key, _) in enumerate(COLUMNS, start=1):
            cell = sheet.cell(row=row_number, column=index)
            value = row.get(key, "")
            if key in ("before", "after") and value:
                path = Path(value) if Path(value).is_absolute() else rows_path.parent / value
                if path.exists():
                    image_height = max(image_height, add_image(sheet, cell.coordinate, path))
                    continue
                value = f"（画像が見つからない: {value}）"
            cell.value = value
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if key == "result" and value in RESULT_FILLS:
                cell.fill = PatternFill("solid", fgColor=RESULT_FILLS[value])
        sheet.row_dimensions[row_number].height = max(60, image_height * 0.75 + 8)

    sheet.freeze_panes = "A2"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    book.save(out_path)
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
