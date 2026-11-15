"""Official words as quran-asr-small hears them, and what a word could be
confused with, from the pinned official text only.

Letters. The model writes 29 letters and a word separator: no vowels, and the
Uthmani spelling. `letters()` is the model's own label recipe
(code/quran_asr/text.py at the pinned revision): marks, small letters, tatweel
and digits out, alif forms folded to ا, ى and ئ to ي, ؤ to و, ة to ه. Run on the
pinned KFGQPC file, never on anything else. It is a lookup key for the judge and
is never shown as Quran text.

Sound. Two spellings of one sound must never be each other's alternative: a
reciter saying the word correctly would be called wrong. `sound_key()` starts
from natural/mutashabih.py's text_key and folds further the few spellings of one
sound that differ in letters:
  - the alif of a joining hamza inside a word: بِٱسۡمِ and بِسۡمِ;
  - waw or ya written where ā is said: صَلَوٰت, ٱلرِّبَوٰاْ, and ى;
  - final ت/ة before a vowel: رَحۡمَتَ and رَحۡمَةَ.
Everything folded here only removes alternatives, so it can cost a catch and
cannot add a mark.

Alternatives of a word, at a place in the text:
  - mutashabih: words that follow the same two words, or come before the same two
    words, anywhere in the official text;
  - near: word types within edit distance 2 of the sound key.
A word whose letters match the expected word is no alternative: the model cannot
tell them apart.
"""
import collections
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'natural'))
import mutashabih as M  # noqa: E402
import text as T  # noqa: E402

LETTERS = 'ءابتثجحخدذرزسشصضطظعغفقكلمنهوي'
FOLD = {
    'أ': 'ا',
    'إ': 'ا',
    'آ': 'ا',
    'ٱ': 'ا',
    'ٲ': 'ا',
    'ٳ': 'ا',
    'ى': 'ي',
    'ئ': 'ي',
    'ے': 'ي',
    'ی': 'ي',
    'ؤ': 'و',
    'ة': 'ه',
    'ک': 'ك',
}
FATHA, DAMMA, KASRA = 'َ', 'ُ', 'ِ'
VOWELS = {FATHA, DAMMA, KASRA, 'ً', 'ٌ', 'ٍ', 'ٗ', 'ٞ', 'ٖ'}


def is_mark(c):
    o = ord(c)
    return (
        0x064B <= o <= 0x065F
        or o == 0x0670
        or 0x06D6 <= o <= 0x06ED
        or o in (0x0640, 0x200F, 0x06DE)
        or 0x0660 <= o <= 0x0669
        or c.isdigit()
    )


def letters(word):
    out = []
    for c in word:
        if is_mark(c):
            continue
        c = FOLD.get(c, c)
        if c in LETTERS:
            out.append(c)
    return ''.join(out)


def sound_key(words, j):
    """text_key of token j, with the spellings of one sound above folded."""
    word = words[j]
    # The alif of a joining hamza inside a word is not said. Only inside: at the
    # start of an ayah it is, and the words before it are the same in both twins.
    pieces = [c for i, c in enumerate(word) if not (c == 'ٱ' and i > 0)]
    # Long ā written with waw or ya and a dagger alif.
    folded = ''.join(pieces).replace('وٰ', 'ٰ').replace('يٰ', 'ٰ').replace('ىٰ', 'ٰ')
    # Final ta written open or closed, before its vowel.
    out = list(folded)
    i = len(out) - 1
    while i >= 0 and (out[i] in VOWELS or out[i] in M.SILENT):
        i -= 1
    if i >= 0 and out[i] == 'ت':
        out[i] = 'ة'
    copy = list(words)
    copy[j] = ''.join(out)
    return M.text_key(copy, j)


def edit_within(a, b, limit):
    """Edit distance if it is at most limit, else None."""
    if abs(len(a) - len(b)) > limit:
        return None
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        low = i
        for j, cb in enumerate(b, 1):
            v = min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (ca != cb))
            cur.append(v)
            low = min(low, v)
        if low > limit:
            return None
        prev = cur
    return prev[-1] if prev[-1] <= limit else None


def deletions(s, depth):
    """All strings with up to depth characters removed."""
    seen = {s}
    frontier = {s}
    for _ in range(depth):
        nxt = set()
        for x in frontier:
            for i in range(len(x)):
                nxt.add(x[:i] + x[i + 1 :])
        seen |= nxt
        frontier = nxt
    return seen


class Index:
    """Letters, sound keys and alternatives for every token of the official text."""

    def __init__(self, hafs=None):
        self.hafs = hafs or T.load_hafs()
        self.keys = T.ayah_keys(self.hafs)
        self.letters = {k: [letters(w) for w in self.hafs[k]] for k in self.keys}
        self.sound = {k: [sound_key(self.hafs[k], j) for j in range(len(self.hafs[k]))] for k in self.keys}
        self._context()
        self._near()

    def _context(self):
        """Tokens by what they follow and by what they come before."""
        self.after = collections.defaultdict(set)
        self.before = collections.defaultdict(set)
        for k in self.keys:
            t = self.hafs[k]
            for j in range(len(t)):
                # Fewer than two words on a side only match at the same edge.
                left = tuple(t[max(0, j - 2) : j]) if j >= 2 else ('<s>',) + tuple(t[:j])
                right = tuple(t[j + 1 : j + 3]) if j + 3 <= len(t) else tuple(t[j + 1 :]) + ('</s>',)
                self.after[left].add((k, j))
                self.before[right].add((k, j))

    def _near(self):
        """Sound key -> letters of word types within edit distance 2."""
        by_sound = collections.defaultdict(set)
        for k in self.keys:
            for s, l in zip(self.sound[k], self.letters[k]):
                by_sound[s].add(l)
        self.by_sound = by_sound
        buckets = collections.defaultdict(set)
        for s in by_sound:
            for d in deletions(s, 2):
                buckets[d].add(s)
        self.near_sound = {}
        for s in by_sound:
            found = set()
            for d in deletions(s, 2):
                found |= buckets[d]
            found.discard(s)
            self.near_sound[s] = sorted(x for x in found if edit_within(s, x, 2) is not None)

    def mutashabih(self, key, j):
        """Letters of the words that could stand here by the text around it."""
        t = self.hafs[key]
        left = tuple(t[max(0, j - 2) : j]) if j >= 2 else ('<s>',) + tuple(t[:j])
        right = tuple(t[j + 1 : j + 3]) if j + 3 <= len(t) else tuple(t[j + 1 :]) + ('</s>',)
        out = set()
        for ctx, table in ((left, self.after), (right, self.before)):
            # An edge alone says nothing: it would match every ayah's first or
            # last word. A context needs two words, or one word and the edge.
            if len(ctx) < 2:
                continue
            for k2, j2 in table.get(ctx, ()):
                if self.sound[k2][j2] != self.sound[key][j] and self.letters[k2][j2] != self.letters[key][j]:
                    out.add(self.letters[k2][j2])
        return sorted(out)

    def near(self, key, j):
        """Letters of word types within distance 2 of this word's sound."""
        own = self.letters[key][j]
        s = self.sound[key][j]
        # A letters form that this sound can also be written as is no alternative.
        same = self.by_sound[s]
        out = set()
        for x in self.near_sound[s]:
            out |= self.by_sound[x]
        return sorted(out - same - {own, ''})
