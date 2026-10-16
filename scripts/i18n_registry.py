# @ai-generated
"""Read the UI language registry for the Python i18n gates.

i18n/languages.ts is the single list of languages; these gates parse it (and
i18n/fonts.ts and the i18n/*.ts data loaders) instead of keeping their own copy, so adding a
language needs no change here. Parsing is deliberately strict: an unexpected
shape raises ValueError rather than silently skipping a language.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _read(root, relative):
    return (root / relative).read_text(encoding='utf-8')


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def load_languages(root=ROOT):
    """Return (source_language, {code: {field: str}}) in SUPPORTED_LANGUAGES order."""
    text = _read(root, 'i18n/languages.ts')
    source = re.search(r"export const SOURCE_LANGUAGE = '([\w-]+)'", text)
    supported = re.search(r'export const SUPPORTED_LANGUAGES = \[([^\]]*)\]', text)
    block = re.search(r'export const LANGUAGES[^=]*= \{\n(.*?)\n\};', text, re.S)
    _require(source and supported and block, 'i18n/languages.ts: registry shape not recognised')
    codes = re.findall(r"'([\w-]+)'", supported.group(1))
    entries = {}
    for match in re.finditer(r'^  ([\w-]+|\'[\w-]+\'): \{\n(.*?)^  \},?$', block.group(1), re.S | re.M):
        code = match.group(1).strip("'")
        entries[code] = dict(re.findall(r"^\s+(\w+): '([^']*)',$", match.group(2), re.M))
    _require(list(entries) == codes,
             f'i18n/languages.ts: LANGUAGES entries {list(entries)} differ from SUPPORTED_LANGUAGES {codes}')
    for code, entry in entries.items():
        for field in ('englishName', 'uiFont', 'status', 'script'):
            _require(field in entry, f'i18n/languages.ts: {code} has no {field}')
    _require(source.group(1) in entries, 'SOURCE_LANGUAGE is not a supported language')
    return source.group(1), entries


def target_languages(requested=None, root=ROOT):
    """Non-source languages, or the requested subset (validated against the registry)."""
    source, entries = load_languages(root)
    targets = [code for code in entries if code != source]
    if not requested:
        return source, {code: entries[code] for code in targets}
    unknown = [code for code in requested if code not in targets]
    _require(not unknown, f'Unknown or source language(s): {unknown}; choose from {targets}')
    return source, {code: entries[code] for code in requested}


def load_ui_fonts(root=ROOT):
    """Map each UiFont name in i18n/fonts.ts to {Manrope alias: font path}."""
    text = _read(root, 'i18n/fonts.ts')
    fonts = {}
    for match in re.finditer(r'^const (\w+)(?::[^=]+)? = \{\n(.*?)^\};', text, re.S | re.M):
        files = dict(re.findall(r"'(Manrope-\w+)': require\('@/([^']+)'\)", match.group(2)))
        if files:
            fonts[match.group(1)] = files
    _require(fonts, 'i18n/fonts.ts: no UI font maps found')
    return fonts


def language_data_files(code, root=ROOT):
    """Bundled per-language display data (data/<name><Code>.json) the i18n module loads.

    Scans i18n/*.ts (not tests) for '@/data/...' imports or requires, so moving a
    loader between files (format.ts, packs.ts, ...) needs no change here.
    """
    suffix = code[:1].upper() + code[1:]
    pattern = re.compile(r"""['"]@/data/([A-Za-z]+[a-z]""" + re.escape(suffix) + r""")\.json['"]""")
    names = set()
    for path in sorted((root / 'i18n').glob('*.ts')):
        names.update(pattern.findall(path.read_text(encoding='utf-8')))
    return [root / f'data/{name}.json' for name in sorted(names)]
