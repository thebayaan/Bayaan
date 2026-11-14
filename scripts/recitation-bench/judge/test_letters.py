"""Exact-match tests of the judge's text tables against the pinned official file.

    python3 -I judge/test_letters.py
"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import letters as L  # noqa: E402

T = L.T
INDEX = L.Index()
PAIRS = json.load(open(os.path.join(HERE, '..', '.out', 'natural', 'manifests', 'w1_pairs.json'), encoding='utf-8'))['pairs']


class Counts(unittest.TestCase):
    def test_counts_match_the_pinned_text(self):
        self.assertEqual(len(INDEX.hafs), T.AYAT)
        self.assertEqual(sum(len(v) for v in INDEX.hafs.values()), T.WORDS)
        self.assertEqual(sum(len(v) for v in INDEX.letters.values()), T.WORDS)

    def test_every_token_has_letters_in_the_model_alphabet(self):
        for k, words in INDEX.letters.items():
            for j, w in enumerate(words):
                self.assertTrue(w, f'{k}:{j} has no letters')
                for c in w:
                    self.assertIn(c, L.LETTERS, f'{k}:{j}')

    def test_letters_never_change_the_text(self):
        # Letters are a subsequence of the source word after folding: nothing is
        # added and no base letter is replaced beyond the model's fold table.
        for k, words in INDEX.hafs.items():
            for j, w in enumerate(words):
                folded = [L.FOLD.get(c, c) for c in w]
                got = iter(folded)
                for c in INDEX.letters[k][j]:
                    self.assertIn(c, got, f'{k}:{j}')


class WordNumbers(unittest.TestCase):
    def test_engine_word_round_trip_on_every_word(self):
        for k, words in INDEX.hafs.items():
            for j in range(len(words)):
                self.assertEqual(T.hafs_token(k, T.engine_word(k, j)), j, f'{k}:{j}')

    def test_split_ayat(self):
        # The engine splits one token in these three ayat, and only there.
        for k, split in T.ENGINE_SPLITS.items():
            self.assertEqual(T.hafs_token(k, split), split)
            self.assertEqual(T.hafs_token(k, split + 1), split)
            self.assertEqual(T.hafs_token(k, split + 2), split + 1)
            self.assertEqual(T.engine_word(k, split + 1), split + 2)

    def test_known_words(self):
        self.assertEqual(INDEX.letters['1:2'], ['الحمد', 'لله', 'رب', 'العلمين'])
        self.assertEqual(INDEX.letters['112:1'], ['قل', 'هو', 'الله', 'احد'])
        self.assertEqual(INDEX.letters['2:43'][1], 'الصلوه')
        self.assertEqual(INDEX.letters['2:124'][2], 'ابرهم')


class Alternatives(unittest.TestCase):
    def test_every_real_pair_is_found_from_the_text_alone(self):
        missing = []
        for p in PAIRS:
            if p['type'] != 'sub' or p['spellingOnly']:
                continue
            a, b, j = p['a'], p['b'], p['token']
            la, lb = INDEX.letters[a][j], INDEX.letters[b][j]
            if la == lb:
                continue
            if lb not in INDEX.mutashabih(a, j):
                missing.append((a, b, j, 'a'))
            if la not in INDEX.mutashabih(b, j):
                missing.append((a, b, j, 'b'))
        self.assertEqual(missing, [])

    def test_spelling_only_pairs_are_never_alternatives(self):
        for p in PAIRS:
            if p['type'] != 'sub' or not p['spellingOnly']:
                continue
            a, b, j = p['a'], p['b'], p['token']
            self.assertEqual(INDEX.sound[a][j], INDEX.sound[b][j], p['id'])
            la, lb = INDEX.letters[a][j], INDEX.letters[b][j]
            if la != lb:
                self.assertNotIn(lb, INDEX.mutashabih(a, j), p['id'])
                self.assertNotIn(la, INDEX.mutashabih(b, j), p['id'])
                self.assertNotIn(lb, INDEX.near(a, j), p['id'])
                self.assertNotIn(la, INDEX.near(b, j), p['id'])

    def test_the_word_is_not_its_own_alternative(self):
        for k in INDEX.keys:
            for j, l in enumerate(INDEX.letters[k]):
                self.assertNotIn(l, INDEX.mutashabih(k, j), f'{k}:{j}')
                self.assertNotIn(l, INDEX.near(k, j), f'{k}:{j}')

    def test_alternatives_are_official_words(self):
        vocab = {w for v in INDEX.letters.values() for w in v}
        for k in list(INDEX.keys)[::50]:
            for j in range(len(INDEX.letters[k])):
                self.assertTrue(set(INDEX.mutashabih(k, j)) <= vocab, f'{k}:{j}')
                self.assertTrue(set(INDEX.near(k, j)) <= vocab, f'{k}:{j}')

    def test_sound_folds(self):
        word = {
            'bismi': ('بِسۡمِ', 'بِٱسۡمِ'),
        }
        for a, b in word.values():
            self.assertEqual(L.sound_key([a], 0), L.sound_key([b], 0))
        # Open and closed ta before a vowel.
        self.assertEqual(L.sound_key(['رَحۡمَتَ'], 0), L.sound_key(['رَحۡمَةَ'], 0))
        # Real differences stay.
        self.assertNotEqual(L.sound_key(['نُوحٌ'], 0), L.sound_key(['لُوطٌ'], 0))
        self.assertNotEqual(L.sound_key(['قَالَ'], 0), L.sound_key(['قُلۡ'], 0))

    def test_edit_within(self):
        self.assertEqual(L.edit_within('abc', 'abc', 2), 0)
        self.assertEqual(L.edit_within('abc', 'axc', 2), 1)
        self.assertEqual(L.edit_within('abc', 'xyc', 2), 2)
        self.assertIsNone(L.edit_within('abc', 'xyz', 2))
        self.assertIsNone(L.edit_within('a', 'abcd', 2))


if __name__ == '__main__':
    unittest.main()
