"""Tests for the chatter tools. Needs numpy.

  $PY -I chatter/test_chatter.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402

from far_field import convolve, synthetic_rir  # noqa: E402
from quran_screen import QuranScreen, mentions_quran, skeletons  # noqa: E402


def check(name, ok, detail=''):
    if not ok:
        raise SystemExit(f'FAILED {name} {detail}')
    print(f'ok {name}')


def test_screen():
    screen = QuranScreen()
    # Written the way a transcript writes them, not in the mushaf's spelling.
    for text in [
        'الحمد لله رب العالمين',
        'بسم الله الرحمن الرحيم',
        'قل هو الله أحد',
        'وأقيموا الصلاة وآتوا الزكاة',
        'يا أيها الذين آمنوا كتب عليكم الصيام',
        'قال الشيخ قل هو الله أحد ثم سكت قليلا',
    ]:
        check(f'finds Quran in: {text}', screen.has_quran(text))
    for text in [
        'قال رئيس الوزراء إن الحكومة ستعلن عن خطة جديدة هذا الأسبوع',
        'إن شاء الله سنذهب غدا إلى السوق',
        'الحمد لله على كل حال يا أخي',
        '',
    ]:
        check(f'leaves ordinary speech: {text!r}', not screen.has_quran(text))
    check('an ayah with four comparable words or more is always found', _long_ayat_found(screen))
    check('ayat read in a row are found across the ayah end', screen.has_quran('والعصر إن الإنسان لفي خسر'))


def _long_ayat_found(screen):
    """Words of only alif, waw and ya (أو, يا) reduce to nothing, so an ayah can
    have four words and fewer to compare. Those are counted, not hidden: alone they
    pass this screen, read with the next ayah they don't, and the chatter-alone run
    is the check on what passes."""
    from text import load_hafs

    too_short = 0
    for key, words in load_hafs().items():
        if len(skeletons(' '.join(words))) < 4:
            too_short += len(words) >= 4
            continue
        if not screen.has_quran(' '.join(words)):
            print('missed', key)
            return False
    print(f'   {too_short} ayat have four words but fewer than four to compare')
    return True


def test_mentions():
    check('english mention', mentions_quran('THE KORAN TEACHES THIS'))
    check('another spelling', mentions_quran('as the Quran says'))
    check('no mention', not mentions_quran('THE RIVER RAN PAST THE MILL'))


def test_rir():
    rng = np.random.default_rng(1)
    sr = 16000
    h = synthetic_rir(rng, rt60=0.5, drr_db=-5.0, sr=sr)
    direct = h[0] ** 2
    tail = np.sum(h[1:] ** 2)
    drr = 10 * np.log10(direct / tail)
    check('direct to reverberant ratio', abs(drr - (-5.0)) < 0.5, f'{drr:.2f}')
    early = np.mean(h[sr // 100 : sr // 100 + 800] ** 2)
    at_rt60 = np.mean(h[sr // 2 : sr // 2 + 800] ** 2)
    drop = 10 * np.log10(early / at_rt60)
    check('tail falls about 60 dB by rt60', 45 < drop < 75, f'{drop:.1f}')


def test_convolve():
    x = np.random.default_rng(2).normal(size=1000).astype(np.float32)
    same = convolve(x, np.array([1.0], dtype=np.float32))
    check('unit response keeps the signal', np.allclose(same, x, atol=1e-5))
    check('output keeps the input length', len(same) == len(x))
    shifted = convolve(x, np.array([0.0, 1.0], dtype=np.float32))
    check('a delay shifts the signal', np.allclose(shifted[1:], x[:-1], atol=1e-5))


if __name__ == '__main__':
    test_screen()
    test_mentions()
    test_rir()
    test_convolve()
    print('all passed')
