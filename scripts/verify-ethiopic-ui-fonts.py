# @ai-generated
"""Verify pinned UI fonts, preserved Latin text and draft Ethiopic coverage.

Requires scripts/rewayah/requirements-ci.txt. Optionally check bundled bytes
with --export-dir <expo export directory>. Native typography review remains
separate. This command writes only an ignored verification report.
"""
import argparse
import hashlib
import json
from pathlib import Path
import unicodedata

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
import uharfbuzz as hb

ROOT = Path(__file__).resolve().parent.parent
FONT_DIRECTORY = ROOT / 'assets/fonts/ethiopic/ui'
WEIGHTS = ('Regular', 'Medium', 'SemiBold', 'Bold', 'Light', 'ExtraLight', 'ExtraBold')
SAMPLES = (
    'In the name of Allāh, the Entirely Merciful. [1]',
    'Yasser Al-Dosari · Al-Fatihah 2:255',
    'Office efficient affine AV To ffi',
    'Original <b>name</b> · 12,345.67',
    'Saheeh International',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
)


def require(condition, message):
    # Explicit failures keep verification enabled even under python -O.
    if not condition:
        raise ValueError(message)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def shaping(path, text):
    font = hb.Font(hb.Face(path.read_bytes()))
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(font, buffer)
    return [
        (info.codepoint, info.cluster, pos.x_advance, pos.y_advance,
         pos.x_offset, pos.y_offset)
        for info, pos in zip(buffer.glyph_infos, buffer.glyph_positions)
    ]


def resource_text(value):
    """Inspect decoded strings: JSON Unicode escapes represent actual UI glyphs."""
    if isinstance(value, str):
        return value
    require(isinstance(value, dict), 'Locale resources must be string/object trees')
    return ''.join(resource_text(child) for child in value.values())


def verify(export_directory=None):
    manifest = json.loads((FONT_DIRECTORY / 'manifest.json').read_text())
    require(len(manifest) == len(WEIGHTS), 'Manifest must contain seven faces')
    records = {row['weight']: row for row in manifest}
    require(set(records) == set(WEIGHTS), 'Manifest weights do not match UI aliases')
    # Locale copy plus bundled Ethiopic data shown through the UI fonts.
    sources = [*(ROOT / 'i18n/locales/am').glob('*.json'), ROOT / 'data/surahNamesAm.json']
    copy = ''.join(resource_text(json.loads(path.read_text(encoding='utf-8')))
                   for path in sources)
    # Include Ethiopic extensions as well as the main Unicode block.
    ethiopic = {char for char in copy + 'አማርኛበያን'
                if unicodedata.name(char, '').startswith('ETHIOPIC')}
    require(ethiopic, 'No Ethiopic draft text found')
    export_hashes = set()
    if export_directory is not None:
        assets = export_directory / 'assets'
        require(assets.is_dir(), f'Missing exported assets directory: {assets}')
        sizes = {row['bytes'] for row in manifest}
        export_hashes = {sha256(path) for path in assets.rglob('*')
                         if path.is_file() and path.stat().st_size in sizes}

    reports = []
    for weight in WEIGHTS:
        record = records[weight]
        expected_file = f'assets/fonts/ethiopic/ui/BayaanUIEthiopic-{weight}.ttf'
        require(record['file'] == expected_file, f'{weight}: unexpected output path')
        for source in ('manrope', 'ethiopic'):
            path = ROOT / record[source]['file']
            require(sha256(path) == record[source]['sha256'],
                    f'{weight}: {source} input differs from manifest')
        old_path = ROOT / f'assets/fonts/Manrope-{weight}.ttf'
        new_path = ROOT / record['file']
        require(sha256(new_path) == record['sha256'], f'{weight}: output hash mismatch')
        require(new_path.stat().st_size == record['bytes'], f'{weight}: output size mismatch')
        if export_directory is not None:
            require(record['sha256'] in export_hashes, f'{weight}: missing or changed export')
        with TTFont(old_path) as old, TTFont(new_path) as new:
            original = old.getBestCmap()
            combined = new.getBestCmap()
            require(set(original) <= set(combined), f'{weight}: missing original cmap glyphs')
            require(all(ord(char) in combined for char in ethiopic),
                    f'{weight}: missing Ethiopic draft glyphs')
            require(new['name'].getDebugName(1) == 'Bayaan UI Ethiopic',
                    f'{weight}: incorrect derivative family name')
            require(new['name'].getDebugName(6) == f'BayaanUIEthiopic-{weight}',
                    f'{weight}: incorrect PostScript name')
            require(old['head'].unitsPerEm == new['head'].unitsPerEm,
                    f'{weight}: changed units per em')
            old_glyphs = old.getGlyphSet()
            new_glyphs = new.getGlyphSet()
            for code, name in original.items():
                require(old['hmtx'][name] == new['hmtx'][combined[code]],
                        f'{weight}: changed advance for {code}')
                before = DecomposingRecordingPen(old_glyphs)
                after = DecomposingRecordingPen(new_glyphs)
                old_glyphs[name].draw(before)
                new_glyphs[combined[code]].draw(after)
                require(before.value == after.value, f'{weight}: changed outline for {code}')
            for char in ethiopic:
                glyph = new['glyf'][combined[ord(char)]]
                if glyph.numberOfContours:
                    require(glyph.yMax <= new['hhea'].ascent and glyph.yMin >= new['hhea'].descent,
                            f'{weight}: Ethiopic ink exceeds line metrics: {char}')
            for field in ('ascent', 'descent', 'lineGap'):
                require(getattr(old['hhea'], field) == getattr(new['hhea'], field),
                        f'{weight}: changed hhea {field}')
            for field in ('sTypoAscender', 'sTypoDescender', 'sTypoLineGap', 'usWinAscent',
                          'usWinDescent', 'fsSelection', 'usWeightClass', 'usWidthClass'):
                require(getattr(old['OS/2'], field) == getattr(new['OS/2'], field),
                        f'{weight}: changed OS/2 {field}')
            for text in SAMPLES:
                require(shaping(old_path, text) == shaping(new_path, text),
                        f'{weight}: changed Latin shaping: {text}')
            reports.append({
                'weight': weight, 'latinGlyphsPreserved': len(original),
                'ethiopicCharacters': len(ethiopic), 'shapeSamples': len(SAMPLES),
                'sha256': record['sha256'], 'bytes': record['bytes'],
            })
    report = {'fonts': reports, 'totalBytes': sum(row['bytes'] for row in reports),
              'manifestVerified': True, 'exportVerified': export_directory is not None}
    logs = ROOT / '.expo/dev/logs'
    logs.mkdir(parents=True, exist_ok=True)
    (logs / 'amharic-ui-font-proof.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Seven pinned faces preserve Latin glyphs, metrics and shaping; '
          f'{len(ethiopic)} Ethiopic characters; export verified: {report["exportVerified"]}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export-dir', type=Path)
    verify(parser.parse_args().export_dir)
