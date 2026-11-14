"""Where the staged sets live. Everything downloaded or built goes under
scripts/recitation-bench/.out/fix2/data, which git ignores."""
import os

STAGE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.abspath(os.path.join(STAGE, '..', '..'))
REPO = os.path.abspath(os.path.join(BENCH, '..', '..'))
FIX2_OUT = os.path.join(BENCH, '.out', 'fix2')
DATA = os.path.join(FIX2_OUT, 'data')
QURAN = os.path.join(REPO, 'data', 'quran.json')
