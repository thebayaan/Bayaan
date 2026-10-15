# @ai-generated
"""Build an OFL UI family retaining Manrope glyphs/metrics plus Noto Ethiopic.

Requires fonttools==4.66.1 and uharfbuzz==0.56.3 (the project's glyph-gate pins).
Original fonts and Quran assets are read only. Output is deterministic.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem
from fontTools import subset
from fontTools.merge import Merger, Options

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / 'assets/fonts/ethiopic'
OUTPUT = INPUT / 'ui'
WEIGHTS = {'Regular': 'Regular', 'Medium': 'Medium', 'SemiBold': 'SemiBold',
           'Bold': 'Bold', 'Light': 'Regular', 'ExtraLight': 'Regular', 'ExtraBold': 'Bold'}


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for weight, ethiopic_weight in WEIGHTS.items():
        latin_path = ROOT / f'assets/fonts/Manrope-{weight}.ttf'
        ethiopic_path = INPUT / f'NotoSansEthiopic-{ethiopic_weight}.ttf'
        latin = TTFont(latin_path)
        ethiopic = TTFont(ethiopic_path)
        # Hint programs target the source UPM. Keep Manrope bytecode untouched;
        # strip only the added script's hints before rescaling it.
        opts = subset.Options()
        opts.hinting = False
        opts.recalc_timestamp = False
        worker = subset.Subsetter(options=opts)
        worker.populate(glyphs=ethiopic.getGlyphOrder())
        worker.subset(ethiopic)
        for tag in ['vhea', 'vmtx']:
            if tag in ethiopic:
                del ethiopic[tag]
        scale_upem(ethiopic, latin['head'].unitsPerEm)
        with TemporaryDirectory() as temp:
            scaled = Path(temp) / 'ethiopic.ttf'
            ethiopic.recalcTimestamp = False
            ethiopic.save(scaled)
            options = Options()
            options.drop_tables = ['STAT']
            merged = Merger(options=options).merge([str(latin_path), str(scaled)])
        # All Ethiopic ink fits these metrics, so existing Latin line boxes stay
        # unchanged. The original Latin glyphs/advances are retained by the merger.
        for field in ['ascent', 'descent', 'lineGap']:
            setattr(merged['hhea'], field, getattr(latin['hhea'], field))
        for field in ['sTypoAscender', 'sTypoDescender', 'sTypoLineGap', 'usWinAscent', 'usWinDescent', 'fsSelection', 'usWeightClass', 'usWidthClass']:
            setattr(merged['OS/2'], field, getattr(latin['OS/2'], field))
        family = 'Bayaan UI Ethiopic'
        values = {0: 'Copyright 2019 The Manrope Project Authors; Copyright 2022 The Noto Project Authors',
                  1: family, 2: weight, 3: f'{family}-{weight}-1.0',
                  4: f'{family} {weight}', 6: f'BayaanUIEthiopic-{weight}',
                  16: family, 17: weight, 13: latin['name'].getDebugName(13),
                  14: latin['name'].getDebugName(14)}
        for record in list(merged['name'].names):
            if record.nameID in values:
                merged['name'].setName(values[record.nameID], record.nameID,
                                       record.platformID, record.platEncID, record.langID)
        merged['head'].created = min(latin['head'].created, ethiopic['head'].created)
        merged['head'].modified = max(latin['head'].modified, ethiopic['head'].modified)
        merged.recalcTimestamp = False
        target = OUTPUT / f'BayaanUIEthiopic-{weight}.ttf'
        merged.save(target)
        records.append({'file': target.relative_to(ROOT).as_posix(), 'weight': weight,
                        'manrope': {'file': latin_path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(latin_path.read_bytes()).hexdigest()},
                        'ethiopic': {'file': ethiopic_path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(ethiopic_path.read_bytes()).hexdigest()},
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'bytes': target.stat().st_size})
    (OUTPUT / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')
    license_text = (INPUT / 'OFL.txt').read_text()
    copyright_line = 'Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope)\n'
    (OUTPUT / 'OFL.txt').write_text(copyright_line + license_text)
    print(f'Built {len(records)} UI faces; {sum(r["bytes"] for r in records)} bytes; original fonts unchanged')


if __name__ == '__main__':
    build()
