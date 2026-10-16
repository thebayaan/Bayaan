# @ai-generated
"""Report per-language resource gaps and deliberately retained source values.

Covers every non-source language in i18n/languages.ts, or only those named with
--language (repeatable). For each language <name> (its lower-case English name)
it reads the optional source-value policy docs/i18n/<name>-source-values.json
(a missing file means no retained values) and renders
docs/i18n/<name>-fallbacks.md. Run with --write to refresh the inventories and
the ignored JSON coverage reports, or --check to require up-to-date inventories
without writing. Never fills or deletes locale keys. In-progress fallback keys
remain permitted.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location('i18n_registry', Path(__file__).with_name('i18n_registry.py'))
registry = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(registry)

NAMESPACES = ('common', 'home', 'collection', 'settings', 'sheets', 'player', 'reader', 'content')
REASONS = {
    'catalogNames': 'Canonical catalog/reference names',
    'canonicalOutputs': 'Canonical outgoing copy/share values',
    'notation': 'Reference and numeric notation',
}
# CLDR plural categories. A translated language may define forms English lacks
# (Arabic zero/two/few/many); the Jest locale tests check the exact set.
PLURAL_CATEGORIES = ('zero', 'one', 'two', 'few', 'many', 'other')


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


def plural_base(key):
    base, _, category = key.rpartition('_')
    return base if base and category in PLURAL_CATEGORIES else None


def triage(key):
    if key.startswith(('content:rewayah.description.', 'content:rewayat.entries.',
                       'settings:mushafSettings.legend')) or key == 'sheets:rewayatInfo.explanation':
        return 'Specialist reference review'
    return 'UI draft pending'


def file_stem(config):
    return config['englishName'].lower().replace(' ', '-')


def load_policy(path):
    if not path.is_file():
        return {}, {}
    policy = load_json(path)
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
    return policy, retained


def render(code, config, policy_name, policy, namespaces, missing, total):
    name = config['englishName']
    lines = [
        f'# {name} source fallback inventory', '',
        f'Generated from the bundled English and {name} resources by `python scripts/report-i18n-coverage.py --language {code} --write`. CI uses `--check` to require a current inventory without changing files. Counts are resource leaves, including individual plural forms, so a language with more plural categories than English populates more leaves than the source has. They do not certify linguistic or native acceptance.', '',
    ]
    if config['status'] == 'inProgress':
        lines += [f'{name} remains `inProgress`. Populated entries include unreviewed {name} copy and explicit original-source values; missing entries use the existing English fallback. Specialist reference material requires qualified fluent review before localization.', '']
    else:
        lines += [f'{name} is `{config["status"]}`: the locale tests require every source key, so this inventory should list no fallbacks.', '']
    lines += [
        f'| Namespace | Source leaves | Populated {name} leaves | Fallback leaves |',
        '| --- | ---: | ---: | ---: |',
    ]
    for namespace, counts in namespaces.items():
        lines.append(f'| {namespace} | {counts["source"]} | {counts["draft"]} | {counts["missing"]} |')
    lines += [f'| **Total** | **{total["source"]:,}** | **{total["draft"]:,}** | **{total["missing"]}** |', '',
              '## Deliberately retained source values', '']
    if policy:
        lines += [f'The [source-value policy]({policy_name}) lists every explicit retained entry. This report enforces byte-for-byte equality with English for these values: canonical catalog/reference names, copied/shared templates and reference/numeric notation preserve their original output. This does not approve any translated copy or make {name} release-ready.', '',
                  '| Policy | Leaves |', '| --- | ---: |']
        for reason, keys in policy.items():
            lines.append(f'| {REASONS[reason]} | {len(keys)} |')
    else:
        lines.append(f'None. Add `docs/i18n/{policy_name}` to require byte-for-byte English values for specific keys.')
    lines += ['', '## Remaining source fallbacks', '']
    if not missing:
        lines += [f'None: every source key has a value in {name}.', '']
    else:
        lines += ['Each key below falls back to English. Keys triaged as specialist reference review (recitation transmissions, tajweed/reference legends and rewayat) are intentionally not machine-translated: religious quotations, source descriptions and technical terminology need a qualified reviewer. Their interface headings/actions are localized separately.', '']
    for namespace in NAMESPACES:
        rows = [row for row in missing if row['key'].startswith(namespace + ':')]
        if not rows:
            continue
        lines += [f'### {namespace}', '', '| Missing source key | Triage | English fallback |', '| --- | --- | --- |']
        for row in rows:
            english = row['english'].replace('|', '\\|').replace('\n', '<br>')
            lines.append(f'| `{row["key"]}` | {row["triage"]} | {english} |')
        lines.append('')
    return '\n'.join(lines)


def report(language, write=False, check=False):
    source_language, targets = registry.target_languages([language], root=ROOT)
    config = targets[language]
    stem = file_stem(config)
    policy_name = f'{stem}-source-values.json'
    policy, retained = load_policy(ROOT / 'docs/i18n' / policy_name)
    namespaces = {}
    missing = []
    values = {}
    for namespace in NAMESPACES:
        source = flatten(load_json(ROOT / f'i18n/locales/{source_language}/{namespace}.json'))
        draft = flatten(load_json(ROOT / f'i18n/locales/{language}/{namespace}.json'))
        plural_bases = {plural_base(key) for key in source} - {None}
        extra = sorted(key for key in set(draft) - set(source)
                       if plural_base(key) not in plural_bases)
        if extra:
            raise ValueError(f'{namespace}: unknown {config["englishName"]} keys: {extra}')
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
    output = {'language': language, 'namespaces': namespaces, 'missing': missing,
              'retainedSourceValues': len(retained), 'totals': total}
    print(json.dumps({'language': language, 'totals': total,
                      'retainedSourceValues': len(retained),
                      'uiGaps': sum(row['triage'] == 'UI draft pending' for row in missing)}))
    if not (write or check):
        return output
    markdown = render(language, config, policy_name, policy, namespaces, missing, total)
    inventory = ROOT / f'docs/i18n/{stem}-fallbacks.md'
    if check:
        if not inventory.is_file() or inventory.read_text(encoding='utf-8') != markdown:
            raise ValueError(
                f'{config["englishName"]} fallback inventory is stale; run python '
                f'scripts/report-i18n-coverage.py --language {language} --write and review the diff'
            )
        return output
    inventory.write_text(markdown, encoding='utf-8')
    logs = ROOT / '.expo/dev/logs'
    logs.mkdir(parents=True, exist_ok=True)
    (logs / f'{stem}-registry-coverage.json').write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
    )
    return output


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--language', action='append', metavar='CODE',
                        help='language code from i18n/languages.ts (default: every non-source language)')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args(argv)
    failures = []
    try:
        _, targets = registry.target_languages(args.language, root=ROOT)
    except (ValueError, OSError) as error:
        parser.exit(1, f'{error}\n')
    for language in targets:
        try:
            report(language, write=args.write, check=args.check)
        except (ValueError, OSError) as error:
            failures.append(f'{language}: {error}')
    if failures:
        parser.exit(1, '\n'.join(failures) + '\n')


if __name__ == '__main__':
    main(sys.argv[1:])
