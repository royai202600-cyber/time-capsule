"""Compose concept-only images without changing approved vessel art."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1]
MASTER = ART / "vessels" / "vessel-hourglass.png"


def normalize_hero():
    path = HERE / "wax-hero.png"
    hero = Image.open(path).convert("RGBA")
    if hero.size == (1024, 1024):
        return
    hero = hero.crop(hero.getchannel("A").getbbox())
    hero.thumbnail((960, 700), Image.Resampling.LANCZOS)
    square = Image.new("RGBA", (1024, 1024))
    square.alpha_composite(hero, ((1024 - hero.width) // 2,
                                  (1024 - hero.height) // 2))
    square.save(path)


def lost_hourglass():
    master = Image.open(MASTER).convert("RGBA")
    damaged = master.copy()
    pixels = damaged.load()
    for y in range(damaged.height):
        for x in range(damaged.width):
            r, g, b, a = pixels[x, y]
            if a:
                # The same clouding and tarnish can be applied to any vessel.
                grey = (r + g + b) // 3
                pixels[x, y] = (
                    int(r * .67 + grey * .20 + 23),
                    int(g * .67 + grey * .20 + 23),
                    int(b * .67 + grey * .20 + 29),
                    a,
                )

    overlay = Image.new("RGBA", damaged.size)
    draw = ImageDraw.Draw(overlay)
    cracks = [
        [(370, 318), (403, 351), (420, 379), (451, 388), (477, 419)],
        [(594, 302), (577, 345), (548, 361), (532, 398)],
        [(666, 528), (632, 556), (611, 595), (570, 610)],
        [(377, 667), (408, 691), (419, 720), (462, 740)],
        [(561, 760), (584, 724), (615, 703), (635, 679)],
        [(455, 825), (430, 842), (401, 835)],
    ]
    for pts in cracks:
        draw.line(pts, fill=(28, 38, 63, 155), width=3, joint="curve")
        for i in range(1, len(pts) - 1, 2):
            x, y = pts[i]
            draw.line([(x, y), (x + 16, y - 13), (x + 25, y - 14)],
                      fill=(28, 38, 63, 115), width=2, joint="curve")
    mist = Image.new("RGBA", damaged.size)
    md = ImageDraw.Draw(mist)
    md.ellipse((290, 700, 740, 940), fill=(28, 38, 63, 38))
    mist = mist.filter(ImageFilter.GaussianBlur(42))
    overlay = Image.alpha_composite(overlay, mist)
    # Lock every new pixel to the approved master alpha, including outer edges.
    overlay.putalpha(Image.composite(overlay.getchannel("A"), Image.new("L", damaged.size),
                                     master.getchannel("A")))
    damaged = Image.alpha_composite(damaged, overlay)
    damaged.putalpha(master.getchannel("A"))
    damaged.save(HERE / "s1-lost-hourglass.png")

    pair = Image.new("RGBA", (1024, 1024))
    for source, x in ((damaged, -180), (master, 332)):
        scaled = source.resize((880, 880), Image.Resampling.LANCZOS)
        pair.alpha_composite(scaled, (x, 72))
    pair.save(HERE / "s1-lost-restored.png")


def contact_sheet():
    bg = (246, 248, 251)
    sheet = Image.new("RGB", (2048, 1024), bg)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 28)
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
    col_x = [16, 528, 1040, 1552]
    cell_w = 480

    def cell(path, x, y, width=480, height=448):
        im = Image.open(HERE / path).convert("RGBA")
        im.thumbnail((width, height), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", (width, height), (246, 248, 251, 255))
        tile.alpha_composite(im, ((width - im.width) // 2, (height - im.height) // 2))
        sheet.paste(tile.convert("RGB"), (x, y))

    y = 0
    draw.text((col_x[0] + 8, y + 4), "Wax keyhole ball", fill=(22, 38, 63), font=font)
    cell("wax-hero.png", col_x[0], y + 44, height=448)
    draw.text((col_x[1] + 8, y + 4), "Hero at actual 64 px", fill=(22, 38, 63), font=small)
    hero = Image.open(HERE / "wax-hero.png").convert("RGBA")
    hero = hero.crop((0, 0, hero.width // 2, hero.height))
    bbox = hero.getchannel("A").point(lambda value: 255 if value > 128 else 0).getbbox()
    hero = hero.crop(bbox).resize((64, 64), Image.Resampling.LANCZOS)
    sheet.paste(hero, (col_x[1] + 208, y + 230), hero)
    draw.text((col_x[2] + 8, y + 4), "Throw screen", fill=(22, 38, 63), font=small)
    cell("wax-throw.png", col_x[2], y + 44, height=448)
    draw.text((col_x[3] + 8, y + 4), "Hit moment", fill=(22, 38, 63), font=small)
    cell("wax-hit.png", col_x[3], y + 44, height=448)

    y = 512
    draw.text((col_x[0] + 8, y + 4), "S1 Lost vs restored", fill=(22, 38, 63), font=font)
    cell("s1-lost-restored.png", col_x[0], y + 44, width=992, height=448)
    sheet.save(HERE / "contact-sheet.png")


if __name__ == "__main__":
    normalize_hero()
    lost_hourglass()
    if all((HERE / f"wax-{phase}.png").exists()
           for phase in ("hero", "throw", "hit")):
        contact_sheet()
