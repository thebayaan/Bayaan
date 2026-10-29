"""Writes the TV app's icons and Top Shelf art from the phone app's icon.

The phone icon is the ink starburst on sky (assets/images/icon.png). Apple
TV gets it as a two-layer parallax icon (sky back, starburst front) at the
three sizes tvOS asks for, plus Top Shelf banners: the sky starburst and the
Bayaan wordmark on the app's ink. tv-app/assets/icon.png becomes the phone
icon itself.

Run from the repo root: python3 tv-app/scripts/gen-tv-brand-images.py
(needs Pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tv-app/assets/tv'
SKY = (141, 201, 214, 255)
INK = (16, 24, 32, 255)  # logo ink, #101820
BG = (5, 11, 16, 255)  # app background, #050b10
CREAM = (244, 243, 236, 255)

# The starburst alone, from the phone's adaptive icon (ink on transparent).
mark = Image.open(ROOT / 'assets/images/adaptive-icon.png').convert('RGBA')
mark = mark.crop(mark.getchannel('A').getbbox())
alpha = mark.getchannel('A')


def starburst(height, colour):
    a = alpha.resize((round(alpha.width * height / alpha.height), height), Image.LANCZOS)
    layer = Image.new('RGBA', a.size, colour)
    layer.putalpha(a)
    return layer


def centred(size, fill, mark_height, colour, dx=0):
    im = Image.new('RGBA', size, fill)
    m = starburst(mark_height, colour)
    im.alpha_composite(m, ((size[0] - m.width) // 2 + dx, (size[1] - m.height) // 2))
    return im


written = []


def save(im, name):
    im.save(OUT / name)
    written.append(name)


for w, h, tag in [(1280, 768, 'large'), (400, 240, 'small'), (800, 480, 'small2x')]:
    save(Image.new('RGBA', (w, h), SKY), f'icon-{tag}-back.png')
    # tvOS crops and scales layers in parallax; keep the mark well inside.
    save(centred((w, h), (0, 0, 0, 0), round(h * 0.5), INK), f'icon-{tag}-front.png')

font = ImageFont.truetype(str(ROOT / 'tv-app/assets/fonts/Manrope-Bold.ttf'), 10)
for w, h, tag in [(1920, 720, 'top-shelf'), (3840, 1440, 'top-shelf@2x'),
                  (2320, 720, 'top-shelf-wide'), (4640, 1440, 'top-shelf-wide@2x')]:
    im = Image.new('RGBA', (w, h), BG)
    m = starburst(round(h * 0.34), SKY)
    font = ImageFont.truetype(str(ROOT / 'tv-app/assets/fonts/Manrope-Bold.ttf'), round(h * 0.2))
    draw = ImageDraw.Draw(im)
    tb = draw.textbbox((0, 0), 'Bayaan', font=font)
    gap = round(h * 0.07)
    total = m.width + gap + (tb[2] - tb[0])
    x = (w - total) // 2
    im.alpha_composite(m, (x, (h - m.height) // 2))
    tx = x + m.width + gap - tb[0]
    ty = (h - (tb[3] - tb[1])) // 2 - tb[1]
    draw.text((tx, ty), 'Bayaan', font=font, fill=CREAM)
    save(im.convert('RGB'), f'{tag}.png')

Image.open(ROOT / 'assets/images/icon.png').convert('RGB').save(ROOT / 'tv-app/assets/icon.png')
written.append('../icon.png')
print('\n'.join(written))
