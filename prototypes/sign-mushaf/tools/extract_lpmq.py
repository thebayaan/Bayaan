"""Extract LPMQ's hand illustrations and mark glyphs from the Pedoman PDF.

The drawings in the Pedoman are vector art, so `pdfimages` finds nothing
useful; we render pages at 600 dpi with pdftoppm and crop.

usage:
  pdftoppm -r 600 -f 23 -l 39 -png Pedoman-Membaca-Mushaf-Al-Quran-Isyarat.pdf <dir>/hr
  python3 extract_lpmq.py <dir> <out_assets_dir>

Writes <out>/letters/<id>.png and <out>/marks/<id>.png (transparent
background, trimmed). Regions are given in 130 dpi page coordinates (the
scale the page images were inspected at) and scaled to 600 dpi.

Internal review only: these are LPMQ (Kemenag RI) illustrations, used pending
permission. Not for distribution.
"""
import os
import sys

from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
S = 600 / 130

LETTER_IDS = [
    'alif', 'ba', 'ta', 'tha', 'jim', 'hha', 'kha',
    'dal', 'dhal', 'ra', 'zay', 'sin', 'shin', 'sad',
    'dad', 'tta', 'zza', 'ain', 'ghain', 'fa', 'qaf',
    'kaf', 'lam', 'mim', 'nun', 'waw', 'ha', 'lam_alif', 'hamza',
    'ya', 'alif_maqsura', 'ta_marbuta',
]
# letter table pages and the x-range of the "GAMBAR" column (130 dpi)
TABLE = [(23, (248, 383)), (24, (222, 358)), (25, (248, 383)), (26, (222, 358)), (27, (248, 383))]

# mark glyphs: id -> (page, x0, y0, x1, y1) at 130 dpi
MARKS = {
    'fathah': (28, 300, 251, 318, 261),
    'kasrah': (28, 302, 492, 312, 509),
    'dammah': (28, 298, 634, 315, 647),
    'fathatain': (28, 326, 838, 353, 849),
    'kasratain': (29, 318, 289, 341, 315),
    'dammatain': (29, 405, 479, 428, 496),
    'sukun': (29, 294, 714, 304, 724),
    'shadda': (30, 328, 779, 346, 790),
    'fathahTegak': (30, 370, 497, 392, 506),
    'kasrahTegak': (30, 297, 777, 306, 798),
    'dammahTerbalik': (31, 323, 223, 341, 235),
    'madd': (31, 329.5, 424, 345, 431),
    'sifr': (32, 266, 439, 273, 447),
    'hamzaFathah': (33, 340, 293, 350, 303),
    'hamzaFathahTegak': (33, 341, 494, 350, 508),
    'hamzaKasrah': (33, 340, 799, 350, 808),
    'hamzaKasrahTegak': (34, 315, 322, 321, 338),
    'hamzaDammah': (34, 304, 443, 321, 454),
    'hamzaDammahTerbalik': (34, 304, 630, 330, 643),
    'hamzaFathatain': (34, 361, 801, 382, 815),
    'hamzaKasratain': (34, 314, 879, 324, 891),
    'hamzaDammatain': (34, 257, 802, 275, 816),
}
# handshapes drawn outside the letter table: id -> (page, x0, y0, x1, y1)
EXTRA_LETTERS = {
    'hamza_tilawah': (38, 265, 780, 301, 822),  # Tilawah hamza (section D.2), palm down, index forward
}


def to_rgba(im, thresh=244):
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > thresh and g > thresh and b > thresh:
                px[x, y] = (255, 255, 255, 0)
    return im


def trim(im, pad=6):
    bb = im.getbbox()
    if not bb:
        return im
    return im.crop((max(bb[0] - pad, 0), max(bb[1] - pad, 0), min(bb[2] + pad, im.width), min(bb[3] + pad, im.height)))


def table_rows(page, xr):
    im = Image.open(f'{SRC}/hr-{page}.png').convert('RGB')
    g = im.convert('L')
    px = g.load()
    x0, x1 = int(xr[0] * S), int(xr[1] * S)
    lines = []
    for y in range(g.height):
        c = sum(1 for x in range(x0 + 20, x1 - 20, 4) if px[x, y] < 120)
        if c > (x1 - x0 - 40) / 4 * 0.8:
            lines.append(y)
    rows = []
    prev = -10
    for y in lines:
        if y - prev > 8:
            rows.append(y)
        prev = y
    cells = []
    for a, b in zip(rows, rows[1:]):
        if b - a < 300:
            continue  # header row or thin gaps
        cells.append(im.crop((x0 + 14, a + 14, x1 - 14, b - 14)))
    return cells


def main():
    os.makedirs(f'{OUT}/letters', exist_ok=True)
    os.makedirs(f'{OUT}/marks', exist_ok=True)
    cells = []
    for page, xr in TABLE:
        rows = table_rows(page, xr)
        cells.extend(rows)
    if len(cells) != len(LETTER_IDS):
        raise SystemExit(f'expected {len(LETTER_IDS)} letter cells, got {len(cells)}')
    for lid, cell in zip(LETTER_IDS, cells):
        trim(to_rgba(cell)).save(f'{OUT}/letters/{lid}.png', optimize=True)
    for lid, (page, x0, y0, x1, y1) in EXTRA_LETTERS.items():
        im = Image.open(f'{SRC}/hr-{page}.png').convert('RGB')
        crop = im.crop((int(x0 * S), int(y0 * S), int(x1 * S), int(y1 * S)))
        trim(to_rgba(crop)).save(f'{OUT}/letters/{lid}.png', optimize=True)
    for mid, (page, x0, y0, x1, y1) in MARKS.items():
        im = Image.open(f'{SRC}/hr-{page}.png').convert('RGB')
        crop = im.crop((int(x0 * S), int(y0 * S), int(x1 * S), int(y1 * S)))
        trim(to_rgba(crop), pad=4).save(f'{OUT}/marks/{mid}.png', optimize=True)
    print('letters', len(cells), 'marks', len(MARKS))


if __name__ == '__main__':
    main()
