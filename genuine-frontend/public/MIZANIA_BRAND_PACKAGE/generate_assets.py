"""Regenerate the Mizania gold-and-charcoal PNG brand assets with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
PNG = ROOT / "logos" / "png"
PWA = ROOT / "pwa"
GOLD = "#D7AE45"
GOLD_LIGHT = "#F0D98F"
GOLD_DARK = "#A77A1D"
INK = "#111214"
CHARCOAL = "#1B1C1F"
PAPER = "#F7F4EC"
WHITE = "#F7F5EF"

FONT_REG = "C:/Windows/Fonts/arial.ttf"
FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf"


def font(size: int, bold: bool = False):
    path = FONT_BOLD if bold else FONT_REG
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def cubic(p0, p1, p2, p3, steps=24):
    points = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        points.append((
            (u**3)*p0[0] + 3*(u**2)*t*p1[0] + 3*u*(t**2)*p2[0] + (t**3)*p3[0],
            (u**3)*p0[1] + 3*(u**2)*t*p1[1] + 3*u*(t**2)*p2[1] + (t**3)*p3[1],
        ))
    return points


def book_icon(size: int, tile=True, background=INK, foreground=GOLD):
    # Supersampling preserves the fine ruled lines in the book at small icon sizes.
    scale = 4
    s = size * scale
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if tile:
        d.rounded_rectangle((s*.035, s*.035, s*.965, s*.965), radius=s*.24,
                             fill=background)
    def pt(p):
        return (round(p[0]*s/128), round(p[1]*s/128))
    def path(parts, color=foreground, width=6):
        points=[]
        current=None
        for part in parts:
            if part[0] == "M":
                current=part[1]
                points.append(pt(current))
            elif part[0] == "L":
                current=part[1]
                points.append(pt(current))
            elif part[0] == "C":
                curve=cubic(current, part[1], part[2], part[3])
                points.extend(pt(p) for p in curve[1:])
                current=part[3]
            elif part[0] == "Z":
                points.append(points[0])
        d.line(points, fill=color, width=round(width*s/128), joint="curve")
    # One confident open ledger mark: a defined spine, balanced pages, and ruled records.
    path([("M",(63,36)),("C",(52,27),(37,27),(22,34)),("L",(22,91)),
          ("C",(39,84),(52,86),(63,96)),("L",(63,36))])
    path([("M",(65,36)),("C",(78,27),(93,27),(106,34)),("L",(106,91)),
          ("C",(89,84),(76,86),(65,96)),("L",(65,36))])
    # Fine page lines are deliberately thick enough to survive a favicon.
    for y, x2 in [(49,49),(63,51),(77,53)]:
        path([("M",(31,y)),("C",(37,y-2),(43,y-2),(x2,y))], width=4)
    for y, x1 in [(49,79),(63,77),(77,75)]:
        path([("M",(x1,y)),("C",(85,y-2),(91,y-2),(97,y))], width=4)
    # Small upward page-corner accent signals continued tracking and progress.
    path([("M",(82,57)),("L",(87,52)),("L",(92,55)),("L",(100,45))],
         color=GOLD_LIGHT, width=4)
    return im.resize((size, size), Image.Resampling.LANCZOS)


def save_wordmark(path: Path, dark: bool):
    im = Image.new("RGBA", (780, 160), (0, 0, 0, 0))
    im.alpha_composite(book_icon(136), (8, 12))
    d = ImageDraw.Draw(im)
    title = WHITE if dark else INK
    tagline = GOLD_LIGHT if dark else GOLD_DARK
    d.text((166, 27), "Mizania", font=font(66, True), fill=title,
           stroke_width=0)
    d.text((171, 111), "REKODI · FUATILIA · ENDELEA", font=font(16, True),
           fill=tagline, stroke_width=0)
    im.save(path)


def save_stacked(path: Path, dark: bool):
    im = Image.new("RGBA", (500, 480), (0, 0, 0, 0))
    im.alpha_composite(book_icon(190), (155, 24))
    d = ImageDraw.Draw(im)
    title = WHITE if dark else INK
    tagline = GOLD_LIGHT if dark else GOLD_DARK
    d.text((250, 279), "Mizania", font=font(64, True), fill=title,
           anchor="mt")
    d.text((250, 365), "REKODI · FUATILIA · ENDELEA", font=font(15, True),
           fill=tagline, anchor="mt")
    im.save(path)


ICON_PATHS = '''<path d="M63 36C52 27 37 27 22 34v57c17-7 30-5 41 5V36Zm2 0c13-9 28-9 41-2v57c-17-7-30-5-41 5V36Z" fill="none" stroke="{gold}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M31 49c6-2 12-2 18 0M31 63c7-2 13-2 20 0M31 77c8-2 15-2 22 0M79 49c6-2 12-2 18 0M77 63c7-2 13-2 20 0M75 77c8-2 15-2 22 0" fill="none" stroke="{gold}" stroke-width="4" stroke-linecap="round"/>
<path d="m82 57 5-5 5 3 8-10" fill="none" stroke="{highlight}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'''


def svg_symbol(bg=None, mono=None):
    paths = ICON_PATHS.format(gold=mono or GOLD, highlight=mono or GOLD_LIGHT)
    tile = f'<rect x="4" y="4" width="120" height="120" rx="30" fill="{bg}"/>\n' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Mizania open ledger mark">
{tile}{paths}
</svg>
'''


def save_svg_assets():
    svg = ROOT / "logos" / "svg"
    svg.mkdir(parents=True, exist_ok=True)
    (svg / "symbol.svg").write_text(svg_symbol(INK), encoding="utf-8")
    (svg / "symbol-monochrome-black.svg").write_text(svg_symbol(mono=INK), encoding="utf-8")
    (svg / "symbol-monochrome-white.svg").write_text(svg_symbol(mono=WHITE), encoding="utf-8")
    for dark, suffix in [(False, "light"), (True, "dark")]:
        title = WHITE if dark else INK
        tagline = GOLD_LIGHT if dark else GOLD_DARK
        mark = svg_symbol(INK)
        (svg / f"wordmark-{suffix}.svg").write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 160" role="img" aria-label="Mizania — Rekodi, fuatilia, endelea">
<g transform="translate(8 12) scale(1.06)">{mark[mark.index("<rect"):mark.rindex("</svg>")]}</g>
<text x="166" y="91" fill="{title}" font-family="Inter, Arial, sans-serif" font-size="70" font-weight="750" letter-spacing="-2">Mizania</text>
<text x="170" y="128" fill="{tagline}" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="3">REKODI · FUATILIA · ENDELEA</text></svg>
''', encoding="utf-8")
        stacked_paths = ICON_PATHS.format(gold=GOLD, highlight=GOLD_LIGHT)
        (svg / f"stacked-{suffix}.svg").write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 480" role="img" aria-label="Mizania — Rekodi, fuatilia, endelea">
<rect x="165" y="22" width="170" height="170" rx="42" fill="{INK}"/>
<g transform="translate(186 43) scale(1.1)">{stacked_paths}</g>
<text x="250" y="290" text-anchor="middle" fill="{title}" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="750" letter-spacing="-2">Mizania</text>
<text x="250" y="332" text-anchor="middle" fill="{tagline}" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="3">REKODI · FUATILIA · ENDELEA</text></svg>
''', encoding="utf-8")
    (svg / "wordmark.svg").write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 160" role="img" aria-label="Mizania — Rekodi, fuatilia, endelea">
<g transform="translate(8 12) scale(1.06)">{svg_symbol(INK)[svg_symbol(INK).index("<rect"):svg_symbol(INK).rindex("</svg>")]}</g>
<text x="166" y="91" fill="{INK}" font-family="Inter, Arial, sans-serif" font-size="70" font-weight="750" letter-spacing="-2">Mizania</text>
<text x="170" y="128" fill="{GOLD_DARK}" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="3">REKODI · FUATILIA · ENDELEA</text></svg>
''', encoding="utf-8")


save_svg_assets()


PNG.mkdir(parents=True, exist_ok=True)
PWA.mkdir(parents=True, exist_ok=True)
save_wordmark(PNG / "mizania-wordmark-light.png", False)
save_wordmark(PNG / "mizania-wordmark-dark.png", True)
save_stacked(PNG / "mizania-stacked-light.png", False)
save_stacked(PNG / "mizania-stacked-dark.png", True)

sizes = [16, 24, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512, 1024]
for size in sizes:
    book_icon(size).save(PNG / f"mizania-app-icon-{size}x{size}.png")

# Maskable icons receive a full gold field and a smaller black safe-area tile.
for size, name in [(192, "mizania-maskable-192x192.png"),
                   (512, "mizania-maskable-512x512.png")]:
    im = Image.new("RGBA", (size, size), GOLD)
    mark = book_icon(round(size*.72), tile=True, background=INK)
    im.alpha_composite(mark, ((size-mark.width)//2, (size-mark.height)//2))
    im.save(PWA / name)

touch = book_icon(180)
touch.save(PWA / "apple-touch-icon-180x180.png")
