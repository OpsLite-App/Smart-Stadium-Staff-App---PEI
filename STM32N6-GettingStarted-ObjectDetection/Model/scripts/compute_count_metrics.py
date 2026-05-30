#!/usr/bin/env python3
"""Compute MAE, NAE and RMSE for person counting.

Usage:
  python compute_count_metrics.py --gt-dir <gt_labels_dir> --pred-dir <pred_labels_dir> [--out csv]

Both gt and pred dirs must contain YOLO-format .txt files with one detection per line.
The script matches files by basename (e.g. 000000001234.txt) and treats missing files as zero detections.
NAE is computed per-image as |pred-gt| / max(1, gt) to avoid divide-by-zero; averaged across images.
"""
import argparse
import csv
import math
import os
from pathlib import Path


def count_lines(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open("r", encoding="utf-8") as f:
        return sum(1 for l in f if l.strip())


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--gt-dir", required=True, help="Ground-truth labels dir (YOLO .txt)")
    p.add_argument("--pred-dir", required=True, help="Predicted labels dir (YOLO .txt)")
    p.add_argument("--out", default=None, help="Optional CSV output path")
    args = p.parse_args()

    gt_dir = Path(args.gt_dir)
    pred_dir = Path(args.pred_dir)
    if not gt_dir.is_dir():
        raise SystemExit(f"GT dir not found: {gt_dir}")
    # Collect basenames from GT (use GT as canonical set)
    basenames = sorted([p.stem for p in gt_dir.glob("*.txt")])
    if not basenames:
        raise SystemExit(f"No .txt files found in GT dir: {gt_dir}")

    gt_counts = []
    pred_counts = []
    rows = []
    for name in basenames:
        gt_file = gt_dir / (name + ".txt")
        pred_file = pred_dir / (name + ".txt")
        gt = count_lines(gt_file)
        pred = count_lines(pred_file)
        gt_counts.append(gt)
        pred_counts.append(pred)
        abs_err = abs(pred - gt)
        rel_err = abs_err / max(1, gt)
        rows.append((name + ".jpg", gt, pred, abs_err, rel_err))

    n = len(rows)
    mae = sum(r[3] for r in rows) / n
    nae = sum(r[4] for r in rows) / n
    rmse = math.sqrt(sum((r[2] - r[1]) ** 2 for r in rows) / n)

    print(f"Images: {n}")
    print(f"MAE: {mae:.4f}")
    print(f"NAE: {nae:.4f}")
    print(f"RMSE: {rmse:.4f}")

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", newline='', encoding="utf-8") as csvf:
            writer = csv.writer(csvf)
            writer.writerow(["image", "gt", "pred", "abs_err", "rel_err"])
            for r in rows:
                writer.writerow(r)
        print(f"Wrote per-image results to {out_path}")


if __name__ == "__main__":
    main()
