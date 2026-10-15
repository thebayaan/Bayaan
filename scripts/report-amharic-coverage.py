# @ai-generated
"""Report Amharic resource gaps and deliberately retained source values.

Run with --write to refresh docs/i18n/amharic-fallbacks.md and the ignored JSON
coverage report, or --check to require an up-to-date inventory without writing.
Never fills or deletes locale keys. In-progress fallback keys remain permitted.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMESPACES = ('common', 'home', 'collection', 'settings', 'sheets', 'player', 'reader', 'content')
REASONS = {
    'catalogNames': 'Canonical catalog/reference names',
    'canonicalOutputs': 'Canonical outgoing copy/share values',
    'notation': 'Reference and numeric notation',
}


def load_json(path):
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f'{path}: duplicate JSON key: {key}')
            result[key] = value
        return result

    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique_object)


def flatten(tree, prefix=''):
    if not isinstance(tree, dict):
        raise ValueError(f'Expected a resource object at {prefix or "root"}')
    result = {}
    for key, value in tree.items():
        path = f'{prefix}.{key}' if prefix else key
        if isinstance(value, str):
            if not value.strip():
                raise ValueError(f'Empty resource value: {path}')
            result[path] = value
        else:
            result.update(flatten(value, path))
    return result


def triage(key):
    if key.startswith(('content:rewayah.description.', 'content:rewayat.entries.',
                       'settings:mushafSettings.legend')) or key == 'sheets:rewayatInfo.explanation':
        return 'Specialist reference review'
    return 'UI draft pending'


def report(write=False, check=False):
    policy = load_json(ROOT / 'docs/i18n/amharic-source-values.json')
    if not isinstance(policy, dict) or set(policy) - set(REASONS):
        raise ValueError('Source policy must contain only known reason groups')
    retained = {}
    for reason, keys in policy.items():
        if not isinstance(keys, list) or any(not isinstance(key, str) for key in keys):
            raise ValueError(f'Source policy group must be a list of keys: {reason}')
        for key in keys:
            if key in retained:
                raise ValueError(f'Duplicate source policy key: {key}')
            retained[key] = reason
    namespaces = {}
    missing = []
    values = {}
    for namespace in NAMESPACES:
        source = flatten(load_json(ROOT / f'i18n/locales/en/{namespace}.json'))
        draft = flatten(load_json(ROOT / f'i18n/locales/am/{namespace}.json'))
        extra = sorted(set(draft) - set(source))
        if extra:
            raise ValueError(f'{namespace}: unknown Amharic keys: {extra}')
        namespaces[namespace] = {'source': len(source), 'draft': len(draft),
                                 'missing': sum(key not in draft for key in source)}
        for key, value in source.items():
            full_key = f'{namespace}:{key}'
            values[full_key] = value
            if full_key in retained and draft.get(key) != value:
                raise ValueError(f'Retained source value changed: {full_key}')
            if key not in draft:
                missing.append({'key': full_key, 'english': value, 'triage': triage(full_key)})
    if set(retained) - set(values):
        raise ValueError('Source policy contains unknown keys')
    total = {key: sum(row[key] for row in namespaces.values())
             for key in ('source', 'draft', 'missing')}
    output = {'namespaces': namespaces, 'missing': missing,
              'retainedSourceValues': len(retained), 'totals': total}
    print(json.dumps({'totals': total, 'retainedSourceValues': len(retained),
                      'uiGaps': sum(row['triage'] == 'UI draft pending' for row in missing)}))
    if not (write or check):
        return output
    lines = [
        '# Amharic source fallback inventory', '',
        'Generated from the bundled English and Amharic resources by `python scripts/report-amharic-coverage.py --write`. CI uses `--check` to require a current inventory without changing files. Counts are resource leaves, including individual plural forms. They do not certify linguistic or native acceptance.', '',
        'Amharic remains `inProgress`. Populated entries include unreviewed Amharic copy and explicit original-source values; missing entries use the existing English fallback. Specialist reference material requires qualified fluent review before localization.', '',
        '| Namespace | Source leaves | Populated Amharic leaves | Fallback leaves |',
        '| --- | ---: | ---: | ---: |',
    ]
    for namespace, counts in namespaces.items():
        lines.append(f'| {namespace} | {counts["source"]} | {counts["draft"]} | {counts["missing"]} |')
    lines += [f'| **Total** | **{total["source"]:,}** | **{total["draft"]:,}** | **{total["missing"]}** |', '',
              '## Deliberately retained source values', '',
              'The [source-value policy](amharic-source-values.json) lists every explicit retained entry. The Amharic integration tests and this report enforce byte-for-byte equality with English for these values. Names follow the registry\'s English-side catalog policy; copied/shared templates and reference/numeric notation preserve their original output. This does not approve any translated copy or make Amharic release-ready.', '',
              '| Policy | Leaves |', '| --- | ---: |']
    for reason, keys in policy.items():
        lines.append(f'| {REASONS[reason]} | {len(keys)} |')
    lines += ['', '## Remaining source fallbacks', '',
              'The remaining descriptions explain recitation transmissions, tajweed/reference legends and rewayat. They are intentionally not machine-translated in this interface pass. Religious quotations, source descriptions and technical terminology need a qualified reviewer. Their interface headings/actions are localized separately.', '']
    for namespace in NAMESPACES:
        rows = [row for row in missing if row['key'].startswith(namespace + ':')]
        if not rows:
            continue
        lines += [f'### {namespace}', '', '| Missing source key | Triage | English fallback |', '| --- | --- | --- |']
        for row in rows:
            english = row['english'].replace('|', '\\|').replace('\n', '<br>')
            lines.append(f'| `{row["key"]}` | {row["triage"]} | {english} |')
        lines.append('')
    inventory = ROOT / 'docs/i18n/amharic-fallbacks.md'
    markdown = '\n'.join(lines)
    if check:
        if not inventory.is_file() or inventory.read_text(encoding='utf-8') != markdown:
            raise ValueError(
                'Amharic fallback inventory is stale; '
                'run python scripts/report-amharic-coverage.py --write and review the diff'
            )
        return output
    inventory.write_text(markdown, encoding='utf-8')
    logs = ROOT / '.expo/dev/logs'
    logs.mkdir(parents=True, exist_ok=True)
    (logs / 'amharic-registry-coverage.json').write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
    )
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        report(write=args.write, check=args.check)
    except (ValueError, OSError) as error:
        parser.exit(1, f'{error}\n')
