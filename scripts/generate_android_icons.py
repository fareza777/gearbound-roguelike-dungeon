"""
Generates all Android mipmap launcher icons (mdpi..xxxhdpi) and rounded icons
from public/assets/ui/app_icon_master.png for the Capacitor Android project.
"""
import os
from PIL import Image, ImageDraw

SRC = r"d:\Spin Adventure Neon\public\assets\ui\app_icon_master.png"
RES = r"d:\Spin Adventure Neon\android\app\src\main\res"

SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

FG_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

def make_round(img: Image.Image) -> Image.Image:
    s = img.size[0]
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, s - 1, s - 1), fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out

def main():
    master = Image.open(SRC).convert("RGBA")
    for folder, px in SIZES.items():
        d = os.path.join(RES, folder)
        os.makedirs(d, exist_ok=True)
        sq = master.resize((px, px), Image.LANCZOS)
        sq.save(os.path.join(d, "ic_launcher.png"), "PNG")
        make_round(sq).save(os.path.join(d, "ic_launcher_round.png"), "PNG")

    for folder, px in FG_SIZES.items():
        d = os.path.join(RES, folder)
        os.makedirs(d, exist_ok=True)
        canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        inner = int(px * 0.72)
        icon = master.resize((inner, inner), Image.LANCZOS)
        off = (px - inner) // 2
        canvas.paste(icon, (off, off), icon)
        canvas.save(os.path.join(d, "ic_launcher_foreground.png"), "PNG")

    print("Generated all Android mipmap icons successfully!")

if __name__ == "__main__":
    main()
