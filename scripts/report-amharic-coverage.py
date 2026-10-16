# @ai-generated
"""Deprecated alias: python scripts/report-i18n-coverage.py --language am [--write|--check].

Kept so existing docs and habits keep working; see report-i18n-coverage.py.
"""
import runpy
from pathlib import Path
import sys

if __name__ == '__main__':
    sys.argv = [str(Path(__file__).with_name('report-i18n-coverage.py')), '--language', 'am', *sys.argv[1:]]
    runpy.run_path(sys.argv[0], run_name='__main__')
