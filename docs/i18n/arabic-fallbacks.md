# Arabic source fallback inventory

Generated from the bundled English and Arabic resources by `python scripts/report-i18n-coverage.py --language ar --write`. CI uses `--check` to require a current inventory without changing files. Counts are resource leaves, including individual plural forms, so a language with more plural categories than English populates more leaves than the source has. They do not certify linguistic or native acceptance.

Arabic is `shipped`: the locale tests require every source key, so this inventory should list no fallbacks.

| Namespace | Source leaves | Populated Arabic leaves | Fallback leaves |
| --- | ---: | ---: | ---: |
| common | 104 | 128 | 0 |
| home | 307 | 335 | 0 |
| collection | 99 | 131 | 0 |
| settings | 260 | 260 | 0 |
| sheets | 239 | 287 | 0 |
| player | 67 | 79 | 0 |
| reader | 41 | 41 | 0 |
| content | 453 | 453 | 0 |
| **Total** | **1,570** | **1,714** | **0** |

## Deliberately retained source values

None. Add `docs/i18n/arabic-source-values.json` to require byte-for-byte English values for specific keys.

## Remaining source fallbacks

None: every source key has a value in Arabic.
