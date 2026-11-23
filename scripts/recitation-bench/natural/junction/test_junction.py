"""Exact-match tests for the junction sites and word-position mapping.

    python3 -I natural/junction/test_junction.py

Every word a junction event names is compared with the pinned official text, and
every engine word number with the engine's corpus. Quran text is never changed
here: a failure means the tool is wrong, not the text.
"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import ending_twins as E  # noqa: E402
import manifests as Mf  # noqa: E402
import sites as S  # noqa: E402
import text as T  # noqa: E402

SITES_FILE = os.path.join(S.OUT, 'sites.json')
LIVE_FILE = os.path.join(S.MAN, 'junction_live.json')
CONTROL_FILE = os.path.join(S.MAN, 'junction_control.json')


def next_ayah(key):
    s, a = key.split(':')
    return f'{s}:{int(a) + 1}'


class SiteTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hafs = T.load_hafs()
        cls.corpus = T.load_corpus()
        cls.sites = S.find_sites(cls.hafs)

    def test_sites_read_as_the_official_text(self):
        self.assertGreater(len(self.sites), 0)
        for site in self.sites:
            x, y = self.hafs[site['x']], self.hafs[site['y']]
            nx, ny = self.hafs[site['nextX']], self.hafs[site['nextY']]
            self.assertNotEqual(site['x'], site['y'])
            self.assertEqual(site['nextX'], next_ayah(site['x']))
            self.assertEqual(site['nextY'], next_ayah(site['y']))
            # X reads 'c L', Y ends with c, and both next ayat open with d.
            self.assertEqual(x[-1], site['word'])
            self.assertEqual(x[-2], site['wordBefore'])
            self.assertEqual(y[-1], site['wordBefore'])
            self.assertEqual(nx[0], site['nextWord'])
            self.assertEqual(ny[0], site['nextWord'])
            self.assertEqual(site['token'], len(x) - 1)
            # Context counts are exact.
            self.assertEqual(x[:-1][-site['left']:], y[-site['left']:])
            self.assertEqual(nx[: site['right']], ny[: site['right']])

    def test_engine_number_of_the_last_word(self):
        for site in self.sites:
            x = site['x']
            self.assertEqual(site['engineLast'], T.engine_word(x, site['token']))
            self.assertEqual(site['engineLast'], len(self.corpus[x]) - 1)
            self.assertEqual(T.hafs_token(x, site['engineLast']), site['token'])

    def test_engine_plain_text_matches_at_the_join(self):
        for site in self.sites:
            x, y = site['x'], site['y']
            plain_x = T.letters(self.corpus[x][site['engineLast']][1])
            self.assertEqual(plain_x, T.letters(site['word']))
            self.assertEqual(T.letters(self.corpus[x][-2][1]), T.letters(self.corpus[y][-1][1]))
            self.assertEqual(
                T.letters(self.corpus[site['nextX']][0][1]),
                T.letters(self.corpus[site['nextY']][0][1]),
            )

    def test_splits_follow_the_last_word(self):
        by_word = {}
        for site in self.sites:
            by_word.setdefault(site['word'], set()).add(site['split'])
        for word, splits in by_word.items():
            self.assertEqual(len(splits), 1, word)

    def test_written_sites_match_a_fresh_scan(self):
        if not os.path.exists(SITES_FILE):
            self.skipTest('sites.json not built')
        with open(SITES_FILE, encoding='utf-8') as f:
            written = json.load(f)
        strip = lambda row: {k: v for k, v in row.items() if k not in ('live', 'control')}
        self.assertEqual([strip(r) for r in written], self.sites)


class ManifestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hafs = T.load_hafs()
        cls.corpus = T.load_corpus()
        cls.metas = {r['slug']: Mf.load_meta(r['slug'], cls.corpus) for r in Mf.load_reciters()}

    def rows(self, path):
        if not os.path.exists(path):
            self.skipTest('manifest not built')
        with open(path, encoding='utf-8') as f:
            return json.load(f)

    def test_live_clips_lock_on_the_same_word_of_the_recording(self):
        for clip in self.rows(LIVE_FILE):
            t = clip['truth']
            y, ny = clip['parts'][0]['key'], clip['parts'][1]['key']
            self.assertEqual(ny, next_ayah(y))
            self.assertEqual(t['audioKey'], y)
            self.assertEqual(next_ayah(t['expectedKey']), t['nextKey'])
            x = t['expectedKey']
            lock = t['lockWord']
            self.assertEqual(clip['trackAt']['word'], lock)
            self.assertEqual(f"{clip['trackAt']['surah']}:{clip['trackAt']['ayah']}", x)
            # The words from the lock to c in X are the recording's last words.
            n = len(self.corpus[x]) - 1 - lock
            self.assertGreaterEqual(n, 1)
            x_words = [T.letters(w[1]) for w in self.corpus[x][lock:-1]]
            y_words = [T.letters(w[1]) for w in self.corpus[y][-n:]]
            self.assertEqual(x_words, y_words)
            # The lock time is when QUA's row starts those words.
            stamps = S.tail_stamps(self.metas[t['reciter']], y, n, len(self.corpus[y]))
            self.assertEqual(clip['trackAt']['t'], stamps[0][0] / 1000)
            self.assertTrue(clip['parts'][0]['audio'].endswith(f"{t['reciter']}/{y.replace(':', '_')}.f32"))

    def test_controls_read_their_own_text(self):
        for clip in self.rows(CONTROL_FILE):
            t = clip['truth']
            x = t['expectedKey']
            self.assertEqual(clip['parts'][0]['key'], x)
            self.assertEqual(clip['parts'][1]['key'], next_ayah(x))
            self.assertEqual(t['audioKey'], x)
            n = len(self.corpus[x]) - t['lockWord']
            stamps = S.tail_stamps(self.metas[t['reciter']], x, n, len(self.corpus[x]))
            self.assertEqual(clip['trackAt']['t'], stamps[0][0] / 1000)


class TwinTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hafs = T.load_hafs()
        cls.corpus = T.load_corpus()
        cls.built = E.build()

    def test_ending_twins_are_official_word_pairs(self):
        self.assertGreater(len(self.built['endings']), 0)
        for y, events in self.built['endings'].items():
            for e in events:
                x = self.hafs[e['x']]
                self.assertNotEqual(e['x'], y)
                self.assertEqual(x[-2], self.hafs[y][-1])
                self.assertEqual(x[-1], e['word'])
                self.assertEqual(e['engineLast'], len(self.corpus[e['x']]) - 1)
                self.assertEqual(T.letters(self.corpus[e['x']][-1][1]), T.letters(e['word']))

    def test_interior_twins_are_official_word_pairs(self):
        self.assertGreater(len(self.built['interior']), 0)
        for y, events in self.built['interior'].items():
            for e in events:
                x = self.hafs[e['x']]
                t = self.hafs[y]
                nx = self.hafs[next_ayah(e['x'])]
                self.assertEqual(x[-2], t[e['token']])
                self.assertEqual(nx[0], t[e['token'] + 1])
                self.assertEqual(x[-1], e['word'])
                self.assertEqual(e['engineWord'], T.engine_word(y, e['token']))

    def test_changed_twins_differ_in_the_last_word_only(self):
        self.assertGreater(len(self.built['changed']), 0)
        for y, events in self.built['changed'].items():
            for e in events:
                x = self.hafs[e['x']]
                self.assertEqual(x[:-1], self.hafs[y][:-1])
                self.assertNotEqual(x[-1], self.hafs[y][-1])
                self.assertEqual(x[-1], e['word'])
                self.assertEqual(e['engineLast'], len(self.corpus[e['x']]) - 1)


if __name__ == '__main__':
    unittest.main(verbosity=1)
