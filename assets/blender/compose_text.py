"""
Compose final Gravity banners from the raw Blender renders.

  python3 assets/blender/compose_text.py

Reads  assets/hero-raw.png, assets/social-raw.png
Writes assets/hero.png,     assets/social.png
"""

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)

FONT_FILE = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT_BOLD = 1      # Helvetica Neue Bold
FONT_LIGHT = 7     # Helvetica Neue Light
FALLBACKS = ["/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial Bold.ttf",
             "/System/Library/Fonts/Supplemental/Arial Bold.ttf"]

BG = np.array([7, 7, 12], dtype=np.float32) / 255.0
TITLE = "GRAVITY"
TAGLINE = ["The self-driving GTM engine —", "from one sentence to booked meetings."]
AMBER = (255, 154, 31)


def font(size, index):
    for path, idx in [(FONT_FILE, index)] + [(p, 1 if index == FONT_BOLD else 0) for p in FALLBACKS]:
        try:
            return ImageFont.truetype(path, size, index=idx)
        except Exception:
            continue
    return ImageFont.load_default()


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def tracked_width(f, text, tracking):
    return sum(f.getlength(c) for c in text) + tracking * (len(text) - 1)


def draw_tracked(draw, xy, text, f, tracking, fill):
    x, y = xy
    for c in text:
        draw.text((x, y), c, font=f, fill=fill)
        x += f.getlength(c) + tracking


def grade(img, gradient_end, gradient_strength):
    """Lift blacks to brand #07070c, add left legibility gradient + vignette + grain."""
    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    h, w, _ = a.shape
    a = 1 - (1 - a) * (1 - BG)                      # screen with bg -> black == #07070c

    xs = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
    ys = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    keep = 1 - gradient_strength * (1 - smoothstep(0.0, gradient_end, xs)) ** 1.6
    a = BG + (a - BG) * keep

    # soft vignette, biased to corners
    cx, cy = 0.6, 0.5
    d = np.sqrt(((xs - cx) * 1.1) ** 2 + ((ys - cy) * 1.6) ** 2)
    vig = 1 - 0.35 * smoothstep(0.45, 1.05, d)
    a = BG + (a - BG) * vig

    rng = np.random.default_rng(3)
    a += rng.normal(0, 1.1 / 255.0, size=a.shape).astype(np.float32)   # dither / grain
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")


def compose(raw_path, out_path, cfg):
    img = Image.open(raw_path).convert("RGB")
    W, H = img.size
    img = grade(img, cfg["gradient_end"], cfg["gradient_strength"])

    title_f = font(int(H * cfg["title_size"]), FONT_BOLD)
    tag_f = font(int(H * cfg["tag_size"]), FONT_LIGHT)
    tracking = title_f.size * cfg["tracking"]
    x0 = int(W * cfg["margin"])

    # vertical layout
    t_asc, t_desc = title_f.getmetrics()
    cap_top = title_f.getbbox("G")[1]                # offset from draw y to cap top
    cap_h = title_f.getbbox("G")[3] - cap_top
    rule_gap = int(H * cfg["rule_gap"])
    rule_h = max(2, int(H * 0.004))
    line_h = int(tag_f.size * 1.42)
    block_h = cap_h + rule_gap + rule_h + rule_gap + line_h * len(TAGLINE)
    top = int(H * cfg["center_y"] - block_h / 2)

    title_y = top - cap_top
    rule_y = top + cap_h + rule_gap
    tag_y = rule_y + rule_h + rule_gap - tag_f.getbbox("T")[1]

    # soft shadow layer for legibility
    shadow = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(shadow)
    draw_tracked(sd, (x0, title_y + H * 0.004), TITLE, title_f, tracking, 200)
    for i, line in enumerate(TAGLINE):
        sd.text((x0, tag_y + i * line_h + H * 0.002), line, font=tag_f, fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(H * 0.012))
    img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img, shadow)

    # faint warm glow behind the wordmark
    glow = Image.new("L", (W, H), 0)
    draw_tracked(ImageDraw.Draw(glow), (x0, title_y), TITLE, title_f, tracking, 255)
    glow = glow.filter(ImageFilter.GaussianBlur(H * 0.03)).point(lambda v: int(v * 0.16))
    img = Image.composite(Image.new("RGB", (W, H), AMBER), img, glow)

    d = ImageDraw.Draw(img)
    draw_tracked(d, (x0, title_y), TITLE, title_f, tracking, (255, 255, 255))

    # thin amber -> transparent accent rule under the wordmark
    rule_w = int(W * cfg["rule_w"])
    rule = Image.new("RGBA", (rule_w, rule_h))
    rp = rule.load()
    for x in range(rule_w):
        a = int(255 * (1 - x / rule_w) ** 1.3)
        for y in range(rule_h):
            rp[x, y] = (*AMBER, a)
    img.paste(rule, (x0 + 2, rule_y), rule)

    for i, line in enumerate(TAGLINE):
        d.text((x0, tag_y + i * line_h), line, font=tag_f, fill=(182, 184, 198))

    img.save(out_path, optimize=True)
    tw = tracked_width(title_f, TITLE, tracking)
    print(f"{out_path}  {W}x{H}  title {title_f.size}px ends at x={x0 + tw:.0f} ({(x0 + tw) / W:.0%})")


HERO = dict(title_size=0.12, tag_size=0.03, tracking=0.15, margin=0.065, center_y=0.5,
            rule_gap=0.03, rule_w=0.06, gradient_end=0.56, gradient_strength=0.9)
SOCIAL = dict(title_size=0.125, tag_size=0.035, tracking=0.13, margin=0.07, center_y=0.5,
              rule_gap=0.032, rule_w=0.07, gradient_end=0.6, gradient_strength=0.9)

if __name__ == "__main__":
    compose(os.path.join(ASSETS, "hero-raw.png"), os.path.join(ASSETS, "hero.png"), HERO)
    compose(os.path.join(ASSETS, "social-raw.png"), os.path.join(ASSETS, "social.png"), SOCIAL)
