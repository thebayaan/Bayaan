# @ai-generated
"""Verify every UI language's text has a glyph in the UI font it renders with.

For each non-source language in i18n/languages.ts (or those named with
--language), resolve its `uiFont` through i18n/fonts.ts to the bundled font
files, then require a cmap entry for every character in that language's locale
JSON and its bundled display data (data/<name><Code>.json loaded by
i18n/*.ts). Decoded JSON values are checked, so Unicode escapes cannot hide
a missing glyph.

Required: every character in the language's own script (registry `script`),
ASCII, and Common/Inherited characters such as punctuation and digits. Other
characters, such as edition names in their original script inside a locale
(`home:tafseerNames`), emoji and variation selectors, are drawn by the platform's
fallback fonts; they are counted in the report but do not fail the check.
Non-rendering characters (controls, format characters, line and paragraph
separators) are skipped; the Jest hygiene test rejects the unsafe ones.

When a selected language uses the Ethiopic derivative fonts, this also runs
scripts/verify-ethiopic-ui-fonts.py (pinned hashes, preserved Latin glyphs,
metrics and shaping; --export-dir checks exported bytes). Requires
scripts/rewayah/requirements-ci.txt. Writes only an ignored report under
.expo/dev/logs.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import unicodedata

from fontTools import unicodedata as font_unicodedata
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SKIPPED_CATEGORIES = ('Cc', 'Cf', 'Zl', 'Zp')
ETHIOPIC_FONT = 'manropeEthiopic'


def load_script(name):
    spec = importlib.util.spec_from_file_location(
        name.replace('-', '_'), Path(__file__).with_name(f'{name}.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


registry = load_script('i18n_registry')


def require(condition, message):
    # Explicit failures keep verification enabled even under python -O.
    if not condition:
        raise ValueError(message)


def resource_text(value):
    """Inspect decoded strings: JSON Unicode escapes represent actual UI glyphs."""
    if isinstance(value, str):
        return value
    require(isinstance(value, dict), 'Locale resources must be string/object trees')
    return ''.join(resource_text(child) for child in value.values())


def language_sources(code, root):
    locales = sorted((root / f'i18n/locales/{code}').glob('*.json'))
    require(locales, f'{code}: no locale files in i18n/locales/{code}')
    return [*locales, *registry.language_data_files(code, root=root)]


def rendered_characters(paths):
    text = ''.join(resource_text(json.loads(path.read_text(encoding='utf-8'))) for path in paths)
    return {char for char in text if unicodedata.category(char) not in SKIPPED_CATEGORIES}


def required_for(script, char):
    """Characters the UI font itself must draw; the rest use platform fallback."""
    if ord(char) < 0x80:
        return True
    if unicodedata.category(char) == 'So' or 'VARIATION SELECTOR' in unicodedata.name(char, ''):
        return False
    if font_unicodedata.script(char) == script:
        return True
    if font_unicodedata.script(char) == 'Zyyy':
        return True
    # Inherited marks count unless their script extensions tie them to another
    # script (Arabic harakat are Inherited but used only with Arabic).
    extensions = font_unicodedata.script_extension(char)
    return font_unicodedata.script(char) == 'Zinh' and (
        script in extensions or extensions <= {'Zyyy', 'Zinh'})


def describe(chars):
    return ', '.join(f'U+{ord(char):04X} {unicodedata.name(char, "?")}' for char in sorted(chars))


def verify_language(code, config, font_maps, root):
    font = config['uiFont']
    require(font in font_maps, f'{code}: uiFont {font!r} has no entry in i18n/fonts.ts')
    sources = language_sources(code, root)
    chars = rendered_characters(sources)
    required = {char for char in chars if required_for(config['script'], char)}
    require(any(font_unicodedata.script(char) == config['script'] for char in required),
            f'{code}: no {config["script"]} text found in its resources')
    files = sorted(set(font_maps[font].values()))
    for relative in files:
        with TTFont(root / relative) as face:
            cmap = face.getBestCmap()
        missing = {char for char in required if ord(char) not in cmap}
        require(not missing, f'{code}: {relative} is missing glyphs for {describe(missing)}')
    return {
        'language': code, 'uiFont': font, 'fonts': files, 'characters': len(required),
        'platformFallbackCharacters': len(chars - required),
        'sources': [str(path.relative_to(root)) for path in sources],
    }


def verify(languages=None, export_directory=None):
    _, targets = registry.target_languages(languages, root=ROOT)
    font_maps = registry.load_ui_fonts(root=ROOT)
    reports = [verify_language(code, config, font_maps, ROOT) for code, config in targets.items()]
    for row in reports:
        print(f'{row["language"]}: {row["characters"]} characters covered by '
              f'{len(row["fonts"])} {row["uiFont"]} faces; '
              f'{row["platformFallbackCharacters"]} other-script/emoji characters left to platform fallback')
    if any(config['uiFont'] == ETHIOPIC_FONT for config in targets.values()):
        ethiopic = load_script('verify-ethiopic-ui-fonts')
        ethiopic.ROOT = ROOT
        ethiopic.FONT_DIRECTORY = ROOT / 'assets/fonts/ethiopic/ui'
        ethiopic.verify(export_directory)
    elif export_directory is not None:
        print('--export-dir applies only to the Ethiopic derivative fonts; not checked')
    logs = ROOT / '.expo/dev/logs'
    logs.mkdir(parents=True, exist_ok=True)
    (logs / 'i18n-ui-font-coverage.json').write_text(json.dumps(reports, indent=2) + '\n')
    return reports


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--language', action='append', metavar='CODE',
                        help='language code from i18n/languages.ts (default: every non-source language)')
    parser.add_argument('--export-dir', type=Path)
    args = parser.parse_args(argv)
    try:
        verify(args.language, args.export_dir)
    except (ValueError, OSError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main(sys.argv[1:])
