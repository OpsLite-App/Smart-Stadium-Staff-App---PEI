#!/usr/bin/env python3
"""Create a smaller subset of the person_dataset for fast local training.

Usage:
  python subsample_person_dataset.py --src person_dataset --dst person_dataset_small --train-max 200 --val-max 50

This copies up to N images (and their corresponding label .txt files) from each split
and writes a `data_person_small.yaml` pointing to the new folders.
"""
import argparse
import os
import random
import shutil
from pathlib import Path

def sample_split(src_images_dir, src_labels_dir, dst_images_dir, dst_labels_dir, max_count):
    os.makedirs(dst_images_dir, exist_ok=True)
    os.makedirs(dst_labels_dir, exist_ok=True)
    all_images = sorted(Path(src_images_dir).glob('*'))
    if not all_images:
        return 0
    if max_count is None or max_count <= 0 or max_count >= len(all_images):
        sel = all_images
    else:
        sel = random.sample(all_images, max_count)
    copied = 0
    for p in sel:
        imgname = p.name
        labelname = Path(imgname).with_suffix('.txt').name
        src_label = os.path.join(src_labels_dir, labelname)
        if not os.path.exists(src_label):
            # skip images without labels
            continue
        shutil.copy2(p, os.path.join(dst_images_dir, imgname))
        shutil.copy2(src_label, os.path.join(dst_labels_dir, labelname))
        copied += 1
    return copied

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--src', default='person_dataset')
    parser.add_argument('--dst', default='person_dataset_small')
    parser.add_argument('--train-max', type=int, default=200)
    parser.add_argument('--val-max', type=int, default=50)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    random.seed(args.seed)

    src = args.src
    dst = args.dst
    train_src_images = os.path.join(src, 'images', 'train')
    val_src_images = os.path.join(src, 'images', 'val')
    train_src_labels = os.path.join(src, 'labels', 'train')
    val_src_labels = os.path.join(src, 'labels', 'val')

    train_dst_images = os.path.join(dst, 'images', 'train')
    val_dst_images = os.path.join(dst, 'images', 'val')
    train_dst_labels = os.path.join(dst, 'labels', 'train')
    val_dst_labels = os.path.join(dst, 'labels', 'val')

    copied_train = sample_split(train_src_images, train_src_labels, train_dst_images, train_dst_labels, args.train_max)
    copied_val = sample_split(val_src_images, val_src_labels, val_dst_images, val_dst_labels, args.val_max)

    print(f'Wrote {copied_train} train images and {copied_val} val images into {dst}')

    # write small data yaml
    data_yaml = f"train: {dst}/images/train\nval: {dst}/images/val\nnc: 1\nnames: ['person']\n"
    yaml_path = os.path.join(dst, 'data_person_small.yaml')
    with open(yaml_path, 'w') as f:
        f.write(data_yaml)
    print('Wrote', yaml_path)

if __name__ == '__main__':
    main()
