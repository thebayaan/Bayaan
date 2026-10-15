> Current registry integration: the original Noto files below remain pinned build inputs. `i18n/fonts.ts` loads the [combined UI faces](ui/README.md), which add explicit Latin coverage while preserving original Manrope glyph geometry, shaping and line metrics. Historical S2–S5 evidence below describes the older SDK 56 preview, not the rebased SDK 57 runtime.

# Noto Sans Ethiopic UI font

Pinned upstream release: [NotoSansEthiopic-v2.102](https://github.com/notofonts/ethiopic/releases/tag/NotoSansEthiopic-v2.102), 2022-11-04. Source archive: [NotoSansEthiopic-v2.102.zip](https://github.com/notofonts/ethiopic/releases/download/NotoSansEthiopic-v2.102/NotoSansEthiopic-v2.102.zip).

Archive SHA-256: `4e3e53aa1586344ba842f310ab35c65281fa11e8cc2d259613ad06a9ae994d52`.

These are unmodified files from `NotoSansEthiopic/hinted/ttf/` in that archive. `OFL.txt` matches its included license byte-for-byte. Copyright 2022 The Noto Project Authors; SIL Open Font License 1.1. No existing Quran/Arabic font asset was changed.

| File | Weight | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `NotoSansEthiopic-Bold.ttf` | 700 | 375,172 | `b45f16db963a94ccb6590b65d3b0e48f55cde011f7c0d4f3c00531e6b8500d6f` |
| `NotoSansEthiopic-Medium.ttf` | 500 | 379,976 | `d5c09c921049aa49066524e68cca4d7a5f5d07c30a0f1f436902910bbb8dd60d` |
| `NotoSansEthiopic-Regular.ttf` | 400 | 376,804 | `f6f7fc379db9438959a2b0527e7a2cf36ea9c84626d56ec444fff37fc24c3c10` |
| `NotoSansEthiopic-SemiBold.ttf` | 600 | 374,200 | `c4447908a95c2a7d8721f047fa19e95700bdf09d1b15e185be922263d3aa72c2` |

Total font payload: 1,506,152 bytes (uncompressed source files, not measured final app-size impact).

FontTools 4.66.1 inspected the cmap, OS/2 weights, and PostScript names. All 106 distinct Ethiopic characters used by the S2 draft resources, `አማርኛ`, and approved brand `በያን` are covered in every weight. Some Latin characters and punctuation fall outside this font's coverage and use platform fallback in mixed text. The settings row containing `GitHub` and `PR` rendered correctly on iPadOS 26.2; Android verification remains pending. Interpolation token names are not displayed glyphs.

S2 loads these statically bundled assets through a separate `expo-font` hook in the existing splash flow. Runtime family aliases match the files' PostScript names (`NotoSansEthiopic-Regular`, `-Medium`, `-SemiBold`, `-Bold`). `useUiFonts` applies them only to migrated interface text and navigation. Font failure resolves startup using platform UI fallback and a development diagnostic. English retains Manrope; Quran fonts, layout, and the domain theme are untouched.

Runtime loading keeps this slice within the checked-in native projects' existing font workflow. Before release, evaluate native expo-font plugin embedding and apply equivalent native project changes; a config-only edit does not embed fonts in existing native projects. Do not run `prebuild --clean` over local native changes.

Actual platform observations and remaining review are recorded in [i18n coverage](../../../docs/development/i18n-coverage.md).

## S3 resource glyph audit — 2026-10-11

FontTools 4.66.1 checked the current five Amharic resource namespaces: all **163 distinct Ethiopic characters** are mapped by every bundled weight, with zero missing characters. The four font files, hashes and 1,506,152-byte source payload above are unchanged. SHA-256 comparisons against the final `.expo/i18n-s3-export` assets confirmed all four are bundled byte-for-byte. This is glyph/bundling evidence; fluent typography review, Android layout proof and final app-size impact remain pending.


## S4a resource glyph audit — 2026-10-12

FontTools 4.66.1 checked the seven current Amharic namespaces plus native language name/brand: all **165 distinct Ethiopic characters** are mapped by every bundled weight, with zero missing characters. The four source files and their 1,506,152-byte payload are unchanged. SHA-256 comparisons against `.expo/i18n-s4-export`'s extensionless asset files confirm all four are bundled byte-for-byte. Native S4 checks are partial; fluent typography, Android layout and final binary size/startup measurements remain pending.


## S4b resource glyph audit — 2026-10-12

FontTools 4.66.1 checked all seven Amharic namespaces plus the native language name/brand: all **166 distinct Ethiopic characters** are mapped by all four unchanged weights, with zero missing characters. SHA-256 comparisons against every `.expo/i18n-s4b-export` asset confirm all four fonts are bundled byte-for-byte. Source payload remains 1,506,152 bytes. Native collection/selector typography, Android, fluent review and final binary size/startup proof remain pending.


## S4c resource glyph audit — 2026-10-12

FontTools 4.66.1 checked all seven Amharic namespaces plus native language name/brand: all **167 distinct Ethiopic characters** are mapped by all four unchanged weights, with zero missing characters. SHA-256 comparisons against every `.expo/i18n-s4c-export` asset confirm all four fonts are bundled byte-for-byte; source payload remains 1,506,152 bytes. Native detail/organization typography, Android, fluent review and release size/startup proof remain pending.


## S5a resource glyph audit — 2026-10-12

FontTools 4.66.1 checked all nine Amharic namespaces plus native language name/brand: all **176 distinct Ethiopic characters** are mapped by every unchanged weight, with zero missing characters. SHA-256 comparisons against every `.expo/i18n-s5a-export` asset confirm all four are bundled byte-for-byte; source payload remains 1,506,152 bytes. UI-font roles remain separate from reading/Arabic fonts. Native reading/edition typography, fluent review, Android and final size/startup proof remain pending.


## S5b resource glyph audit — 2026-10-12

FontTools 4.66.1 checked the nine current Amharic namespaces (765 messages), native language name and approved brand: all **176 distinct Ethiopic characters** are mapped by every unchanged weight, with zero missing characters. SHA-256 comparisons against every `.expo/i18n-s5b-export` asset confirm all four fonts bundled byte-for-byte; source payload remains 1,506,152 bytes. UI roles apply only to translated control text and empty-note placeholders; actual religious content, saved-note/metadata/reference fonts and rendering retain their original styles. Native verse/playback typography, large-text/VoiceOver, Android/tablet, fluent review and release size/startup proof remain pending.


## S5c resource glyph audit — 2026-10-13

FontTools 4.66.1 checked all nine Amharic namespaces (805 messages), native language name and approved brand: all **177 distinct Ethiopic characters** are mapped by every unchanged weight, with zero missing characters. SHA-256 comparisons against every `.expo/i18n-s5c-export` asset confirm all four fonts bundled byte-for-byte; source payload remains 1,506,152 bytes. Only panel/share interface font roles change; Quran/translation/tafseer/phrase/theme/community content fonts and preview/capture/HTML/WBW rendering remain original. Native shaping/layout, large-text/VoiceOver, Android/tablet, fluent review and release size/startup proof remain pending.


## S5d resource glyph audit — 2026-10-13

FontTools 4.66.1 checked all ten Amharic namespaces (885 messages), native language name and approved brand: all **177 distinct Ethiopic characters** are mapped by every unchanged weight, with zero missing characters. SHA-256 comparisons against every `.expo/i18n-s5d-export` asset confirm all four fonts bundled byte-for-byte; source payload remains 1,506,152 bytes. Reading/adhkar controls use UI roles while religious/counter/reference/catalog fonts and page/sample/preview rendering stay original; native toolbar typography remains OS-owned. Native shaping/layout, large-text/VoiceOver, Android/tablet, fluent review and release size/startup proof remain pending.


## S5e resource glyph audit — 2026-10-13

FontTools 4.66.1 checked all ten Amharic namespaces (904 messages), native language name and approved brand: all **178 distinct Ethiopic characters** map in every unchanged weight. All four SHA-256 hashes match exported `.expo/i18n-s5e-export` assets; source payload remains 1,506,152 bytes. App-owned error/UI samples use UI font roles; religious sample strings/styles/renderers and unknown error fonts stay original. Partial iPhone Debug observations show Amharic control labels beside original Quran/adhkar body and preview fonts. Full shaping/layout, large-text/VoiceOver, Android/tablet, fluent review and release size/startup proof remain pending.


## S5f resource glyph audit — 2026-10-13

FontTools 4.66.1 checked all ten Amharic namespaces (928 messages), native language name and approved brand: every unchanged weight maps all **179 distinct Ethiopic characters**. All four SHA-256 hashes match final `.expo/i18n-s5f-export` assets; source payload remains 1,506,152 bytes. UI leaves/cards/actions use UI roles, while word/footnote/religious bodies, name/reference fonts and shaping/layout stay original. Partial native recent-options observations confirm visible Amharic labels beside literal headers after the spacing fix. Full reading/badge/word-detail typography, large-text/VoiceOver, Android/tablet, fluent review and release size/startup evidence remain pending.
