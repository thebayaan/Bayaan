# @ai-generated
"""Regressions for the CI gates; all mutations stay inside temporary fixtures."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f'scripts/{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


coverage = load_script('report-amharic-coverage')
fonts = load_script('verify-ethiopic-ui-fonts')


class CoverageGateTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.write_json('docs/i18n/amharic-source-values.json', {
            'catalogNames': ['common:name'], 'canonicalOutputs': [], 'notation': [],
        })
        for namespace in coverage.NAMESPACES:
            source = {'name': 'Canonical name'} if namespace == 'common' else {'label': 'Label'}
            draft = {'name': 'Canonical name'} if namespace == 'common' else {'label': 'ሙከራ'}
            self.write_json(f'i18n/locales/en/{namespace}.json', source)
            self.write_json(f'i18n/locales/am/{namespace}.json', draft)
        self.addCleanup(patch.stopall)
        patch.object(coverage, 'ROOT', self.root).start()

    def write_json(self, relative, value):
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(value), encoding='utf-8')

    def report(self, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            return coverage.report(**kwargs)

    def files(self):
        return {path.relative_to(self.root): path.read_bytes()
                for path in self.root.rglob('*') if path.is_file()}

    def test_check_detects_deleted_translation_without_writing_or_filling_it(self):
        self.report(write=True)
        self.write_json('i18n/locales/am/home.json', {})
        before = self.files()
        with self.assertRaisesRegex(ValueError, 'inventory is stale'):
            self.report(check=True)
        self.assertEqual(self.files(), before)

    def test_reviewed_inventory_allows_in_progress_fallbacks_without_writes(self):
        self.write_json('i18n/locales/en/settings.json', {
            'mushafSettings': {'legend': {'description': 'Reference explanation'}},
            'newUi': 'New interface string',
        })
        self.write_json('i18n/locales/am/settings.json', {})
        self.report(write=True)
        before = self.files()
        result = self.report(check=True)
        self.assertEqual(self.files(), before)
        self.assertEqual(result['totals']['missing'], 2)
        self.assertEqual({row['triage'] for row in result['missing']}, {
            'Specialist reference review', 'UI draft pending',
        })

    def test_missing_inventory_fails_without_creating_it(self):
        before = self.files()
        with self.assertRaisesRegex(ValueError, 'inventory is stale'):
            self.report(check=True)
        self.assertEqual(self.files(), before)

    def test_canonical_output_changes_fail_even_with_a_regenerated_inventory(self):
        self.write_json('i18n/locales/am/common.json', {'name': 'Changed name'})
        with self.assertRaisesRegex(ValueError, 'Retained source value changed: common:name'):
            self.report(write=True)

    def test_duplicate_json_keys_cannot_be_hidden_by_the_json_parser(self):
        path = self.root / 'i18n/locales/am/home.json'
        path.write_text('{"label":"lost value","label":"replacement"}', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'duplicate JSON key: label'):
            self.report(check=True)

    def test_empty_and_invalid_resource_leaves_fail(self):
        for value in (' ', None, 2, ['label']):
            with self.subTest(value=value):
                self.write_json('i18n/locales/am/home.json', {'label': value})
                with self.assertRaises(ValueError):
                    self.report(check=True)

    def test_unknown_locale_keys_and_source_policy_entries_fail(self):
        self.write_json('i18n/locales/am/home.json', {'typo': 'ሙከራ'})
        with self.assertRaisesRegex(ValueError, 'unknown Amharic keys'):
            self.report(check=True)
        self.write_json('i18n/locales/am/home.json', {'label': 'ሙከራ'})
        self.write_json('docs/i18n/amharic-source-values.json', {'catalogNames': ['home:typo']})
        with self.assertRaisesRegex(ValueError, 'Retained source value changed|unknown keys'):
            self.report(check=True)

    def test_malformed_or_duplicate_policy_keys_fail(self):
        for policy in (
            {'unknownReason': []}, {'catalogNames': 'common:name'},
            {'catalogNames': ['common:name', 'common:name']},
            {'catalogNames': ['common:name'], 'notation': ['common:name']},
        ):
            with self.subTest(policy=policy):
                self.write_json('docs/i18n/amharic-source-values.json', policy)
                with self.assertRaises(ValueError):
                    self.report(check=True)


class FontGateTests(unittest.TestCase):
    def test_json_escaping_cannot_hide_a_missing_ethiopic_glyph(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = json.loads((fonts.FONT_DIRECTORY / 'manifest.json').read_text())
            # Corrupt only a temporary derivative, then repin its hash so the
            # regression exercises glyph coverage rather than the hash gate.
            for record in manifest:
                for relative in (record['file'], record['manrope']['file'],
                                 record['ethiopic']['file']):
                    target = root / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(ROOT / relative, target)
            record = next(row for row in manifest if row['weight'] == 'Regular')
            derivative = root / record['file']
            with TTFont(derivative) as font:
                for table in font['cmap'].tables:
                    if table.isUnicode():
                        table.cmap.pop(0x1200, None)
                font.save(derivative)
            record['sha256'] = fonts.sha256(derivative)
            record['bytes'] = derivative.stat().st_size
            font_directory = root / 'assets/fonts/ethiopic/ui'
            (font_directory / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
            locales = root / 'i18n/locales/am'
            locales.mkdir(parents=True)
            (locales / 'common.json').write_text(
                json.dumps({'label': 'ሀ'}, ensure_ascii=True), encoding='utf-8'
            )
            (root / 'data').mkdir()
            (root / 'data/surahNamesAm.json').write_text(
                json.dumps({'1': 'አ'}, ensure_ascii=True), encoding='utf-8'
            )
            with patch.object(fonts, 'ROOT', root), patch.object(fonts, 'FONT_DIRECTORY', font_directory):
                with self.assertRaisesRegex(ValueError, 'missing Ethiopic draft glyphs'):
                    fonts.verify()

    def test_only_decoded_values_contribute_ui_text(self):
        tree = json.loads('{"nested":{"label":"\\u1200"},"not UI text":"Latin"}')
        self.assertEqual(fonts.resource_text(tree), 'ሀLatin')


if __name__ == '__main__':
    unittest.main()
