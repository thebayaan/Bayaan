"""Exact-match tests of the natural benchmark against the pinned text.

    python3 -I natural/test_natural.py

Text tests always run. Tests of the staged metadata and manifests run when those
files exist under .out/natural.
"""
import collections
import glob
import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mutashabih as M  # noqa: E402
import text as T  # noqa: E402
import w5 as W5  # noqa: E402


def banned_source(url):
    """qua.banned_source, without importing what the stager needs."""
    import importlib.util

    spec = importlib.util.spec_from_file_location('qua', os.path.join(T.HERE, 'qua.py'))
    qua = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(qua)
    return qua.banned_source(url)

MAN = os.path.join(T.OUT, 'manifests')
HAFS = T.load_hafs()
APP = T.load_app()
CORPUS = T.load_corpus()
BUILT = M.build()


class PinnedText(unittest.TestCase):
    def test_hash_and_counts(self):
        self.assertEqual(T.sha256(T.HAFS_FILE), T.PINS['hafs'])
        self.assertEqual(T.sha256(T.APP_FILE), T.PINS['app'])
        self.assertEqual(len(HAFS), T.AYAT)
        self.assertEqual(sum(len(v) for v in HAFS.values()), T.WORDS)
        self.assertEqual(sum(len(v) for v in APP.values()), T.WORDS)
        self.assertEqual(sum(len(v) for v in CORPUS.values()), T.ENGINE_WORDS)

    def test_tokens_are_the_source_text(self):
        """Joined tokens equal the source with only signs and spaces out."""
        with open(T.HAFS_FILE, encoding='utf-8') as f:
            rows = json.load(f)
        for r in rows:
            key = f"{r['sura_no']}:{r['aya_no']}"
            raw = r['aya_text'].replace('\xa0', ' ').split()
            words = [w for w in raw if not T.is_ayah_number(w)]
            kept = ''.join(c for w in words for c in w if c not in T.STANDALONE_SIGNS)
            self.assertEqual(''.join(HAFS[key]), kept, key)

    def test_no_ayah_number_survives(self):
        for source in (HAFS, APP):
            for key, words in source.items():
                for w in words:
                    self.assertFalse(T.is_ayah_number(w), f'{key} {w}')
                    self.assertFalse(any(c.isdigit() for c in w), f'{key} {w}')

    def test_app_text_differs_only_in_tatweel_of_kalla(self):
        diffs = [
            (k, j)
            for k in HAFS
            for j, (a, b) in enumerate(zip(HAFS[k], APP[k]))
            if a != b
        ]
        self.assertEqual(len(diffs), 33)
        for k, j in diffs:
            self.assertEqual(HAFS[k][j], APP[k][j].replace('ـ', ''), k)
            self.assertEqual(T.letters(HAFS[k][j]), 'كل')


class WordNumbers(unittest.TestCase):
    def test_every_word_of_the_quran_maps(self):
        checked = 0
        for key, words in HAFS.items():
            engine = CORPUS[key]
            split = T.ENGINE_SPLITS.get(key)
            self.assertEqual(len(engine), len(words) + (1 if split is not None else 0), key)
            for i, word in enumerate(words):
                e = T.engine_word(key, i)
                self.assertEqual(T.hafs_token(key, e), i, f'{key} token {i}')
                if i == split:
                    joined = T.letters(engine[e][1]) + T.letters(engine[e + 1][1])
                    self.assertEqual(T.letters(word), joined, key)
                    self.assertEqual(T.hafs_token(key, e + 1), i)
                else:
                    self.assertEqual(T.letters(word), T.letters(engine[e][1]), f'{key}:{i}')
                checked += 1
        self.assertEqual(checked, T.WORDS)

    def test_split_ayat_are_the_known_ones(self):
        got = {k for k in HAFS if len(HAFS[k]) != len(CORPUS[k])}
        self.assertEqual(got, set(T.ENGINE_SPLITS))

    def test_letters_tells_words_apart(self):
        self.assertNotEqual(T.letters('ٱلۡحَكِيمِ'), T.letters('ٱلۡعَلِيمِ'))
        self.assertNotEqual(T.letters('نُوحٌ'), T.letters('لُوطٌ'))
        self.assertEqual(T.letters('ٱلرَّحِيمِ'), T.letters('ٱلرَّحِيمِ'))


class RecitedMap(unittest.TestCase):
    OFFICIAL = ['a1', 'b2', 'c3', 'd4', 'e5']

    def test_plain(self):
        self.assertEqual(T.recited_map(['ب', 'ت'], ['ب', 'ت']), ([0, 1], 0))

    def test_restart_maps_back(self):
        official = ['ب', 'ت', 'ث', 'ج', 'ح']
        recited = ['ب', 'ت', 'ث', 'ت', 'ث', 'ج', 'ح']
        self.assertEqual(T.recited_map(recited, official), ([0, 1, 2, 1, 2, 3, 4], 1))

    def test_other_text_is_refused(self):
        self.assertEqual(T.recited_map(['ب', 'د'], ['ب', 'ت']), (None, 0))

    def test_missing_word_is_refused(self):
        self.assertEqual(T.recited_map(['ب'], ['ب', 'ت']), (None, 0))


class W1(unittest.TestCase):
    PAIRS = BUILT['pairs']

    def test_recount(self):
        c = BUILT['counts']
        self.assertEqual(c['words'], 77430)
        self.assertEqual(c['identicalPairs'], 632)
        self.assertEqual(c['sub'], 126)
        self.assertEqual(c['subLast'], 66)
        self.assertEqual(c['indel'], 11)
        self.assertEqual(c['endingPairs'], 9)
        self.assertEqual(c['dropLastUsable'], 3)
        self.assertEqual(c['spellingOnly'], 7)

    def test_substitutions_differ_in_exactly_that_word(self):
        for p in self.PAIRS:
            if p['type'] != 'sub':
                continue
            a, b, j = HAFS[p['a']], HAFS[p['b']], p['token']
            self.assertEqual(len(a), len(b), p['id'])
            self.assertEqual(a[:j], b[:j], p['id'])
            self.assertEqual(a[j + 1 :], b[j + 1 :], p['id'])
            self.assertNotEqual(a[j], b[j], p['id'])
            self.assertEqual(a[j], p['wordA'])
            self.assertEqual(b[j], p['wordB'])
            self.assertEqual(T.letters(CORPUS[p['a']][p['engineA']][1]), T.letters(a[j]))
            self.assertEqual(T.letters(CORPUS[p['b']][p['engineB']][1]), T.letters(b[j]))

    def test_insertions_are_one_word(self):
        for p in self.PAIRS:
            if p['type'] not in ('indel', 'short_indel'):
                continue
            long_, short, j = HAFS[p['long']], HAFS[p['short']], p['token']
            self.assertEqual(long_[:j] + long_[j + 1 :], short, p['id'])
            self.assertEqual(long_[j], p['word'])
            self.assertEqual(
                T.letters(CORPUS[p['long']][p['engineLong']][1]), T.letters(long_[j])
            )

    def test_dropped_last_word_is_a_whole_recording(self):
        got = [p for p in self.PAIRS if p['type'] == 'drop_last']
        self.assertEqual(len(got), 3)
        for p in got:
            x, y = HAFS[p['long']], HAFS[p['short']]
            self.assertEqual(x[p['startToken'] : -1], y, p['id'])
            self.assertEqual(p['token'], len(x) - 1)
            self.assertEqual(x[-1], p['word'])
        self.assertEqual(sum(p['wholeAyah'] for p in got), 1)

    def test_the_other_ending_pairs_differ_earlier(self):
        self.assertEqual(len(BUILT['endingOnly']), 6)
        for e in BUILT['endingOnly']:
            x, y = HAFS[e['x']], HAFS[e['y']]
            self.assertEqual(x[-4:-1], y[-3:], e)
            self.assertNotEqual(x[-1 - len(y) : -1], y, e)

    def test_junction(self):
        got = [p for p in self.PAIRS if p['type'] == 'junction']
        self.assertEqual(len(got), 1)
        p = got[0]
        self.assertEqual(HAFS[p['long']][-3:-1], HAFS[p['short']][-2:])
        n = p['nextWordsInCommon']
        self.assertEqual(HAFS[p['nextLong']][:n], HAFS[p['nextShort']][:n])

    def test_spelling_only_pairs_sound_the_same(self):
        for p in self.PAIRS:
            if p['type'] != 'sub':
                continue
            same = ''.join(w[0] for w in CORPUS[p['a']]) == ''.join(w[0] for w in CORPUS[p['b']])
            self.assertEqual(p['spellingOnly'], same, p['id'])
            if same:
                self.assertEqual(p['textDistance'], 0, p['id'])
            else:
                self.assertGreater(p['textDistance'], 0, p['id'])

    def test_no_pair_uses_a_split_ayah_at_the_split(self):
        for p in self.PAIRS:
            for side in ('a', 'b', 'long', 'short'):
                if p.get(side) in T.ENGINE_SPLITS:
                    self.fail(f"{p['id']} uses a split ayah: word numbers need a look")


class W5Sites(unittest.TestCase):
    SITES = W5.sites()

    def test_every_site_is_an_official_token(self):
        for category, entries in self.SITES.items():
            for e in entries:
                self.assertEqual(HAFS[e['key']][e['token']], e['word'], category)
                self.assertEqual(
                    T.letters(CORPUS[e['key']][e['engine']][1]), T.letters(e['word']), e
                )

    def test_named_sites(self):
        got = {c: {e['key'] for e in v} for c, v in self.SITES.items()}
        self.assertEqual(got['sakta'], {'18:1', '36:52', '69:28', '75:27', '83:14'})
        self.assertIn('30:54', got['options'])
        self.assertEqual(sum(e['key'] == '30:54' for e in self.SITES['options']), 3)
        self.assertEqual(got['written_form'], {'17:32', '24:31', '43:49', '55:31'})
        self.assertEqual(len(self.SITES['muqattaat']), 30)
        self.assertGreaterEqual(len(self.SITES['madd_lazim']), 95)


class RiwayahDiff(unittest.TestCase):
    def test_port_gives_the_pinned_counts(self):
        with tempfile.TemporaryDirectory() as out:
            subprocess.run(
                [sys.executable, '-I', '-B', os.path.join(T.HERE, 'riwayah_diff.py'), out],
                check=True,
                capture_output=True,
            )
            with open(os.path.join(out, 'summary2.json'), encoding='utf-8') as f:
                got = json.load(f)
        self.assertEqual(
            {r: (v['paired_tokens'], v['unaligned_hafs_tokens']) for r, v in got.items()},
            {
                'warsh': (77422, 8),
                'qaloon': (77422, 8),
                'doori': (77422, 8),
                'soosi': (77422, 8),
                'shouba': (77430, 0),
                'bazzi': (77426, 4),
                'qumbul': (77428, 2),
            },
        )


@unittest.skipUnless(os.path.exists(os.path.join(MAN, 'w1.json')), 'manifests not built')
class Manifests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        def load(name):
            with open(os.path.join(MAN, f'{name}.json'), encoding='utf-8') as f:
                return json.load(f)

        cls.w1 = load('w1')
        cls.control = load('w1_control')
        cls.pool = load('pool')
        cls.w5 = load('w5')
        with open(os.path.join(MAN, 'reciters.json'), encoding='utf-8') as f:
            cls.reciters = {r['slug'] for r in json.load(f)['chosen']}

    def test_target_words_are_the_right_words(self):
        for c in self.w1:
            t = c['truth']
            x, y = t['expectedKey'], t['audioKey']
            if t['type'] in ('changed', 'trap'):
                self.assertEqual(HAFS[x][T.hafs_token(x, t['target'])], t['expectedWord'], c['id'])
                self.assertEqual(HAFS[y][T.hafs_token(y, t['target'])], t['heardWord'], c['id'])
            elif t['type'] in ('skipped', 'dropped_last', 'junction'):
                self.assertEqual(HAFS[x][T.hafs_token(x, t['target'])], t['word'], c['id'])
            elif t['type'] == 'added':
                self.assertEqual(HAFS[y][t['target']], t['word'], c['id'])

    def test_clips_say_what_they_run(self):
        for c in self.w1:
            t = c['truth']
            s, a = t['expectedKey'].split(':')
            self.assertEqual(c['expected']['surah'], int(s))
            self.assertEqual(c['expected']['ayah'], int(a))
            self.assertTrue(c['flush'])
            self.assertIn(t['reciter'], self.reciters)
            path = c['audio'] if 'audio' in c else c['parts'][0]['audio']
            self.assertIn(f"/{t['reciter']}/", path)
            self.assertTrue(path.endswith(t['audioKey'].replace(':', '_') + '.f32'), path)

    def test_w1_recordings_are_the_text_once(self):
        for c in self.w1:
            stamps = c['truth']['stamps']
            self.assertEqual(len(stamps), len(CORPUS[c['truth']['audioKey']]), c['id'])

    def test_pool_reads_ayat_in_order(self):
        for c in self.pool:
            keys = [p['key'] for p in c['parts']]
            s = {k.split(':')[0] for k in keys}
            self.assertEqual(len(s), 1, c['id'])
            ayat = [int(k.split(':')[1]) for k in keys]
            self.assertEqual(ayat, list(range(ayat[0], ayat[0] + len(ayat))), c['id'])
            self.assertEqual(c['truth']['words'], sum(len(CORPUS[k]) for k in keys))
            self.assertNotEqual(next(iter(s)), '112')

    def test_pool_size(self):
        words = collections.Counter()
        for c in self.pool:
            words[c['truth']['reciter']] += c['truth']['words']
        self.assertGreaterEqual(sum(words.values()), 66000)
        self.assertGreaterEqual(len(words), 20)

    def test_every_recited_row_is_the_official_text(self):
        rows = restarts = 0
        for f in glob.glob(os.path.join(T.OUT, 'qua_meta/*.jsonl')):
            with open(f, encoding='utf-8') as h:
                for line in h:
                    r = json.loads(line)
                    key = f"{r['surah']}:{r['ayah']}"
                    mapping, n = T.recited_map(
                        T.tokens(r['text_uthmani']), [w[1] for w in CORPUS[key]]
                    )
                    self.assertIsNotNone(mapping, f'{f} {key}')
                    self.assertEqual(len(mapping), len(r['word_timestamps']), key)
                    rows += 1
                    restarts += n > 0
        self.assertEqual(rows, 124619)
        self.assertEqual(restarts, 20969)

    def test_no_banned_source(self):
        hosts = set()
        for f in glob.glob(os.path.join(T.OUT, 'qua_meta/*.jsonl')):
            with open(f, encoding='utf-8') as h:
                for line in h:
                    url = json.loads(line)['source_url']
                    hosts.add(url.split('/')[0])
                    self.assertFalse(banned_source(url), url)
        self.assertEqual(
            hosts, {'cdn.mp3quran.net', 'media.way2quran.com', 'download.tvquran.com'}
        )


if __name__ == '__main__':
    unittest.main(verbosity=1)
