#!/usr/bin/env python3
"""Generate Android launcher assets from the OpsLite dragon logo."""

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "microsite" / "public" / "logo.jpeg"
RES = ROOT / "frontend-web" / "android" / "app" / "src" / "main" / "res"
SIZES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}


def dragon_layer(size: int, padding_ratio: float) -> Image.Image:
    source = Image.open(SOURCE).convert("L")
    alpha = source.point(lambda value: 255 if value < 96 else 0)
    dragon = Image.new("RGBA", source.size, (7, 24, 37, 0))
    dragon.putalpha(alpha)

    content_size = round(size * (1 - 2 * padding_ratio))
    dragon.thumbnail((content_size, content_size), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - dragon.width) // 2, (size - dragon.height) // 2)
    canvas.alpha_composite(dragon, offset)
    return canvas


def legacy_icon(size: int, round_icon: bool = False) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (255, 153, 0, 255))
    if round_icon:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        canvas.putalpha(mask)
    canvas.alpha_composite(dragon_layer(size, 0.16))
    return canvas


for density, (legacy_size, foreground_size) in SIZES.items():
    target = RES / f"mipmap-{density}"
    legacy_icon(legacy_size).save(target / "ic_launcher.png")
    legacy_icon(legacy_size, round_icon=True).save(target / "ic_launcher_round.png")
    dragon_layer(foreground_size, 0.28).save(target / "ic_launcher_foreground.png")

print(f"Generated Android launcher icons from {SOURCE}")
