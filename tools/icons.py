#!/usr/bin/env python3
"""Малює іконки застосунку в icons/ (потрібен Pillow). Запуск: python3 tools/icons.py"""
import math
import pathlib

from PIL import Image, ImageDraw

INK = (12, 20, 32, 255)
ACCENT = (255, 91, 46, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # supersampling for smooth edges

out = pathlib.Path(__file__).resolve().parent.parent / "icons"
out.mkdir(exist_ok=True)


def draw_icon(size, maskable=False, rounded=True):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, s, s], fill=INK)
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=INK)
    # Safe zone for maskable icons is the inner 80 %.
    scale = 0.62 if maskable else 0.78
    c = s / 2
    r = s * scale / 2
    # Sector wedge: azimuth 0° (north), width 70°.
    start, end = -90 - 35, -90 + 35
    d.pieslice([c - r, c - r, c + r, c + r], start, end, fill=ACCENT)
    # Dial ring.
    w = max(2, int(s * 0.035))
    d.ellipse([c - r, c - r, c + r, c + r], outline=WHITE, width=w)
    # Ticks at the cardinal points.
    for a in (0, 90, 180, 270):
        rad = math.radians(a)
        x1, y1 = c + math.sin(rad) * r, c - math.cos(rad) * r
        x2, y2 = c + math.sin(rad) * (r - s * 0.07), c - math.cos(rad) * (r - s * 0.07)
        d.line([x1, y1, x2, y2], fill=WHITE, width=w)
    # Needle and hub.
    tip = r * 0.95
    d.line([c, c, c, c - tip], fill=WHITE, width=int(w * 1.4))
    hub = s * 0.065
    d.ellipse([c - hub, c - hub, c + hub, c + hub], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)


draw_icon(192).save(out / "icon-192.png")
draw_icon(512).save(out / "icon-512.png")
draw_icon(512, maskable=True).save(out / "icon-maskable-512.png")
draw_icon(180, rounded=False).save(out / "apple-touch-icon.png")
draw_icon(32).save(out / "favicon-32.png")
print("icons written to", out)
