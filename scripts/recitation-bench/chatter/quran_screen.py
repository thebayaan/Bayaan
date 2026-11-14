"""Finds Quran text in a speech transcript, so the chatter tracks hold none.

A clip is dropped when any four words in a row of its transcript match four words
in a row of the mushaf, read across ayah ends. Spelling is compared on a skeleton
without alif, waw and ya, so everyday spelling (الصلاة) meets the mushaf's
(ٱلصَّلَوٰةَ). That also drops some ordinary sentences, which costs nothing.

This compares text only and is used for nothing but choosing clips. The official
text is read through natural/text.py and never changed.
"""
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'natural'))

from text import ayah_keys, letters, load_hafs  # noqa: E402

NGRAM = 4
MENTION = re.compile(r'\b(koran|quran|qur.an|alcoran)\b', re.IGNORECASE)


def skeleton(word):
    bare = letters(word).replace('و', '').replace('ي', '')
    return ''.join(c for c in bare if unicodedata.category(c) == 'Lo')


def skeletons(text):
    return [s for s in (skeleton(w) for w in text.split()) if s]


class QuranScreen:
    def __init__(self):
        hafs = load_hafs()
        run = []
        for key in ayah_keys(hafs):
            run.extend(skeletons(' '.join(hafs[key])))
        self.grams = {tuple(run[i : i + NGRAM]) for i in range(len(run) - NGRAM + 1)}

    def has_quran(self, text):
        words = skeletons(text)
        return any(
            tuple(words[i : i + NGRAM]) in self.grams
            for i in range(len(words) - NGRAM + 1)
        )


def mentions_quran(text):
    """For English transcripts, where a four-word match cannot apply."""
    return bool(MENTION.search(text))
