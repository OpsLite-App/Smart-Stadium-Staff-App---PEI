#!/usr/bin/env python3
"""Convert COCO annotations -> YOLO single-class (person) dataset.

Usage:
  python convert_coco_person_to_yolo.py --coco_root ../../COCO --out_dir person_dataset

This will create `person_dataset/images/{train,val}` and `person_dataset/labels/{train,val}` containing
only images that have COCO 'person' annotations and corresponding YOLO label files (class 0).
"""
import argparse
import json
import os
import shutil
from pathlib import Path

def ensure_dir(p):
    os.makedirs(p, exist_ok=True)

def convert_split(coco_root, ann_file, images_dir, out_images_dir, out_labels_dir):
    with open(ann_file, 'r', encoding='utf8') as f:
        coco = json.load(f)

    images = {img['id']: img for img in coco['images']}
    anns_by_image = {}
    for ann in coco['annotations']:
        if ann.get('category_id') != 1:  # person category in COCO
            continue
        anns_by_image.setdefault(ann['image_id'], []).append(ann)

    ensure_dir(out_images_dir)
    ensure_dir(out_labels_dir)

    copied = 0
    for img_id, anns in anns_by_image.items():
        img = images[img_id]
        fname = img['file_name']
        src = os.path.join(images_dir, fname)
        dst_img = os.path.join(out_images_dir, fname)
        if not os.path.exists(src):
            continue
        shutil.copy2(src, dst_img)
        # write label file
        w = img['width']
        h = img['height']
        label_lines = []
        for a in anns:
            x, y, bw, bh = a['bbox']
            x_c = x + bw / 2.0
            y_c = y + bh / 2.0
            # normalize
            x_n = x_c / w
            y_n = y_c / h
            bw_n = bw / w
            bh_n = bh / h
            label_lines.append(f"0 {x_n:.6f} {y_n:.6f} {bw_n:.6f} {bh_n:.6f}")
        label_path = os.path.join(out_labels_dir, Path(fname).with_suffix('.txt').name)
        with open(label_path, 'w', encoding='utf8') as lf:
            lf.write('\n'.join(label_lines))
        copied += 1

    return copied

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--coco_root', default='../../COCO', help='Path to COCO folder (extracted)')
    p.add_argument('--out_dir', default='person_dataset', help='Output dataset folder inside Model')
    args = p.parse_args()

    coco_root = os.path.abspath(args.coco_root)
    out_dir = os.path.abspath(args.out_dir)

    # expected layout in coco_root: train2017/, val2017/, annotations/instances_train2017.json
    train_images = os.path.join(coco_root, 'train2017', 'train2017')
    val_images = os.path.join(coco_root, 'val2017', 'val2017')
    ann_dir = os.path.join(coco_root, 'annotations_trainval2017', 'annotations')
    ann_train = os.path.join(ann_dir, 'instances_train2017.json')
    ann_val = os.path.join(ann_dir, 'instances_val2017.json')

    if not os.path.isdir(coco_root):
        raise SystemExit(f'COCO root not found: {coco_root}')

    # prepare output folders
    train_out_images = os.path.join(out_dir, 'images', 'train')
    val_out_images = os.path.join(out_dir, 'images', 'val')
    train_out_labels = os.path.join(out_dir, 'labels', 'train')
    val_out_labels = os.path.join(out_dir, 'labels', 'val')

    ensure_dir(train_out_images)
    ensure_dir(val_out_images)
    ensure_dir(train_out_labels)
    ensure_dir(val_out_labels)

    copied_train = 0
    copied_val = 0
    if os.path.exists(ann_train) and os.path.isdir(train_images):
        copied_train = convert_split(coco_root, ann_train, train_images, train_out_images, train_out_labels)
    else:
        print('Train annotations or images not found; skipping train')

    if os.path.exists(ann_val) and os.path.isdir(val_images):
        copied_val = convert_split(coco_root, ann_val, val_images, val_out_images, val_out_labels)
    else:
        print('Val annotations or images not found; skipping val')

    print(f'Copied {copied_train} train images and {copied_val} val images with person annotations into {out_dir}')

if __name__ == '__main__':
    main()
