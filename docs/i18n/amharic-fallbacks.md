# Amharic source fallback inventory

Generated from the bundled English and Amharic resources by `python scripts/report-i18n-coverage.py --language am --write`. CI uses `--check` to require a current inventory without changing files. Counts are resource leaves, including individual plural forms, so a language with more plural categories than English populates more leaves than the source has. They do not certify linguistic or native acceptance.

Amharic remains `inProgress`. Populated entries include unreviewed Amharic copy and explicit original-source values; missing entries use the existing English fallback. Specialist reference material requires qualified fluent review before localization.

| Namespace | Source leaves | Populated Amharic leaves | Fallback leaves |
| --- | ---: | ---: | ---: |
| common | 104 | 104 | 0 |
| home | 307 | 307 | 0 |
| collection | 99 | 99 | 0 |
| settings | 260 | 260 | 0 |
| sheets | 239 | 239 | 0 |
| player | 67 | 67 | 0 |
| reader | 41 | 41 | 0 |
| content | 453 | 453 | 0 |
| **Total** | **1,570** | **1,570** | **0** |

## Deliberately retained source values

The [source-value policy](amharic-source-values.json) lists every explicit retained entry. This report enforces byte-for-byte equality with English for these values: canonical catalog/reference names, copied/shared templates and reference/numeric notation preserve their original output. This does not approve any translated copy or make Amharic release-ready.

| Policy | Leaves |
| --- | ---: |
| Canonical catalog/reference names | 0 |
| Canonical outgoing copy/share values | 0 |
| Reference and numeric notation | 10 |

## Remaining source fallbacks

None: every source key has a value in Amharic.
