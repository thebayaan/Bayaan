# Amharic source fallback inventory

Generated from the bundled English and Amharic resources by `python scripts/report-amharic-coverage.py --write`. CI uses `--check` to require a current inventory without changing files. Counts are resource leaves, including individual plural forms. They do not certify linguistic or native acceptance.

Amharic remains `inProgress`. Populated entries include unreviewed Amharic copy and explicit original-source values; missing entries use the existing English fallback. Specialist reference material requires qualified fluent review before localization.

| Namespace | Source leaves | Populated Amharic leaves | Fallback leaves |
| --- | ---: | ---: | ---: |
| common | 104 | 104 | 0 |
| home | 307 | 307 | 0 |
| collection | 99 | 99 | 0 |
| settings | 260 | 260 | 0 |
| sheets | 239 | 239 | 0 |
| player | 54 | 54 | 0 |
| reader | 41 | 41 | 0 |
| content | 438 | 438 | 0 |
| **Total** | **1,542** | **1,542** | **0** |

## Deliberately retained source values

The [source-value policy](amharic-source-values.json) lists every explicit retained entry. The Amharic integration tests and this report enforce byte-for-byte equality with English for these values. Names follow the registry's English-side catalog policy; copied/shared templates and reference/numeric notation preserve their original output. This does not approve any translated copy or make Amharic release-ready.

| Policy | Leaves |
| --- | ---: |
| Canonical catalog/reference names | 0 |
| Canonical outgoing copy/share values | 0 |
| Reference and numeric notation | 10 |

## Remaining source fallbacks

The remaining descriptions explain recitation transmissions, tajweed/reference legends and rewayat. They are intentionally not machine-translated in this interface pass. Religious quotations, source descriptions and technical terminology need a qualified reviewer. Their interface headings/actions are localized separately.
