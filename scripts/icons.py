"""Génère les icônes de l'application (dégradé indigo → émeraude avec « € »). Usage : python3 scripts/icons.py"""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
FONT = subprocess.run(["fc-match", "-f", "%{file}", "sans:bold"], capture_output=True, text=True).stdout.strip()

def icon(size: int, scale: float, rounded: bool) -> Image.Image:
    top, bottom = (79, 70, 229), (16, 185, 129)  # indigo-600 → emerald-500
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(size * 0.55 * scale))
    draw.text((size / 2, size / 2), "€", fill="white", font=font, anchor="mm")
    if not rounded:
        return img
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, mask=mask)
    return out

icon(192, 1, True).save(OUT / "icon-192.png")
icon(512, 1, True).save(OUT / "icon-512.png")
icon(512, 0.75, False).save(OUT / "icon-512-maskable.png")  # zone de sécurité pour les icônes adaptatives
icon(180, 1, False).save(OUT / "apple-touch-icon.png")       # iOS arrondit lui-même les coins
print("Icônes générées dans", OUT)
