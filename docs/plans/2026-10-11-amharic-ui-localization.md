# Amharic interface localization — rebased implementation plan

| Field | Value |
| --- | --- |
| Status | Development draft integrated with upstream registry; fluent/native/release acceptance pending |
| Updated | 2026-10-15 |
| Branch | `feature/amharic-reading-controls` |
| Base | `develop` / `origin/develop`, last merged at `b31362cf` (2026-10-15); originally rebased onto `6dd37983` |
| Governing guide | [i18n guidelines](../i18n/README.md) |
| Upstream design | [Arabic i18n/RTL plan](../superpowers/plans/2026-10-12-arabic-support.md) |
| Feature RFC | [RFC-022](../rfcs/022-amharic-i18n.md) |

## Outcome and boundary

Add Amharic to Bayaan's existing interface framework. The app's Quran verses, translations, tafseer, word data, Arabic/Quran fonts, renderer, selected editions, recitations, stored names/notes and provider contracts remain outside this change. Do not translate Quran content or automatically choose an Amharic Quran edition. The approved display spelling of Bayaan is **በያን**, a transliteration only; canonical branding, identifiers, URLs, fork names and outgoing share payloads retain their original values.

The upstream branch now ships English and Arabic, with Expo SDK 57 / React Native 0.86.3. The earlier ten-namespace SDK 56 implementation is preserved in a retained stash and a hashed local snapshot; it is not replayed over the upstream language system. Historical S1–S5 evidence in the [coverage record](../development/i18n-coverage.md) applies to the old base only.

## Design aligned with the current repository

- Register `am` in `i18n/languages.ts` with `status: 'inProgress'`, LTR direction, Ethiopic script, Western digits/separators, English-side catalog names and `understandsArabic: false`. Exception (2026-10-15, requested by the contributor): surah names use bundled Ethiopic phonetic spellings in `data/surahNamesAm.json`, not translated meanings, and the English meaning subtitle is hidden. Reciter names stay Latin until the backend serves per-language names.
- Reuse the eight upstream namespaces in `i18n/locales/am/` and imports in `i18n/resources.ts`. No second i18next instance, language store, custom startup flow, plural polyfill or UI font hook.
- Keep the upstream `intl-pluralrules`, fixed session language, MMKV preference, direction bootstrap, reload behavior, typed keys, number/date helpers and RTL/media boundaries unchanged.
- Use the registry for policy. The documented `bayaanTransliteration` field is set for every language; `getAppDisplayName` consults it only at interface display sites. Existing English/Arabic and fork branding are preserved.
- Use `i18n/fonts.ts` aliases. The initial Noto files lack Latin letters, so seven OFL UI derivatives combine each original Manrope face with pinned Noto Sans Ethiopic 2.102. They preserve Manrope's cmap glyph geometry, advances, shaping and line metrics; originals remain unchanged. See [font provenance and verification](../../assets/fonts/ethiopic/ui/README.md).
- Keep every translated plural group complete for Amharic's `one` (0/1) and `other` categories. Adapt interpolation variable names to the upstream English key, never concatenate translated fragments or introduce extra keys.
- Maintain the draft Amharic glossary column in the governing guide. No resource is called fluent-reviewed merely because automated checks pass.

## Current coverage and next implementation work

The resources contain **1,352 populated leaves across eight namespaces**, against **1,421 English source leaves**. The ordinary UI queue is addressed with **286 new unreviewed Amharic drafts** and **155 explicit source values**, preserving all 881 prior entries. The remaining **69 fallbacks** are specialist reference descriptions/legend terminology requiring qualified review; no religious quotations or reference explanations were machine-translated.

| Namespace | Populated | Source | Fallback |
| --- | ---: | ---: | ---: |
| common | 104 | 104 | 0 |
| home | 188 | 188 | 0 |
| collection | 99 | 99 | 0 |
| settings | 233 | 260 | 27 |
| sheets | 238 | 239 | 1 |
| player | 54 | 54 | 0 |
| reader | 41 | 41 | 0 |
| content | 395 | 436 | 41 |

The [per-key fallback inventory](../i18n/amharic-fallbacks.md) is reproducible with `python scripts/report-amharic-coverage.py --write`. The [source-value policy](../i18n/amharic-source-values.json) preserves 132 catalog/reference names, 13 outgoing copy/share templates and 10 numeric/reference notations. Resource tests and the report enforce equality with English. Catalog headings and adhkar navigation titles/tags are interface metadata; their religious bodies and provider data remain unchanged. All draft copy remains awaiting fluent review, and source-value coverage is not a claim of translation completeness.

## Development verification

Follow Observe → Plan → Build → Verify → Review → Record. Each change needs readable AI markers, formatting/TypeScript, lint on changed code, `npm run i18n:check`, and `npx jest i18n/`. Use the full repository suite with `BAYAAN_OVERLAY_DB_DIR=bundled` when updating framework/registry integration. Diff all protected data/renderers/domain services and English/Arabic resources against the new develop base.

Font builds/checks use the existing pins in `scripts/rewayah/requirements-ci.txt`:

```bash
python scripts/build-ethiopic-ui-fonts.py
python scripts/verify-ethiopic-ui-fonts.py
python scripts/verify-ethiopic-ui-fonts.py --export-dir .expo/amharic-registry-export
```

The verifier enforces manifest source/output hashes, output byte counts and derivative names; its optional export check verifies all seven bundled hashes. Automated glyph and HarfBuzz checks establish coverage and original Latin geometry/shaping; they do not replace native typography review. Local CI-equivalent commands use the working Node 22 installation; the local `node@24` link currently points to a broken Node 25 installation. The local `.bin/prettier` points to Jest's older snapshot formatter; use the installed `prettier` API with `resolveConfig`/`filepath` for formatting and checks. No global runtime was modified.

## Release gates — not completed

1. Review the 69 specialist-reference fallbacks and explicit source-value policy; every released interface resource must be complete.
2. Obtain fluent Amharic review of all draft copy, terminology, placeholders, plurals and typography. The user approved the brand spelling only.
3. SDK 57 iOS Debug client build/install/launch completed on 2026-10-13; initial iPhone native observations are recorded in the coverage document. Complete native QA with this client and an Android client. SDK 56 observations do not validate this integration.
4. Check Home, player, mushaf, settings and sheets on iOS and Android; add tablet, accessibility font sizes, VoiceOver/TalkBack, offline/cold start, system-language and preference persistence. Verify Quran appearance, selected editions, copied/shared religious values, route, playback position and queue.
5. Measure installed size/startup impact. Seven UI faces total 2,677,600 source bytes; export payload is not an installed-size/startup measurement.
6. Only after completion/review, add Amharic native supported-language declarations, rebuild, and set `status: 'shipped'`. No store publication or deployment is authorized by this plan.

The resumed standards checks include 161 passing i18n tests, with six new cases for development/release gating, saved Amharic preferences, session reload and Arabic-to-Amharic direction. The broad regression before the latest resource-only pass passed 2,572 tests across 206 suites, with two tests/one suite skipped. Two new focused cases protect retained source values and localized reader/Trans/plural output. Formatting, TypeScript, i18n checks and font/export hash verification pass, with zero added lint diagnostics. A fresh SDK 57 iOS/Android production export passes after the new entries. See the coverage record for exact checks and the separate native-client setup evidence.

Current English/Arabic release behavior and their native locale declarations are preserved. Amharic is development-only. Verification results and outstanding gates are recorded in the coverage document. No feature commit, push or PR was created.

## Resumed native handoff — 2026-10-13

The interrupted SDK 57 iOS build finished successfully. The rebuilt client is installed on the existing iPhone 17 Pro / iOS 26.2 simulator and uses the running Metro server at port 8081. Amharic selection triggers the upstream session reload and displays Ethiopic interface text. Initial screenshots/accessibility observations cover the language picker, Home, Settings, About, Collection, the collection action sheet, adhkar navigation/source bodies, mushaf page 1 and reading playback options. Catalog names, Quran/adhkar source text and numeric playback/reference values remain visibly literal; no actual share/copy, annotation, download or playback operation was performed.

Device Hub coordinate input fails with `noWindowsAvailable`; accessibility presses and application deep links work for some routes. This is partial iPhone smoke evidence, not full native acceptance. The [current coverage handoff](../development/i18n-coverage.md#sdk-57-native-smoke-verification--2026-10-13) records limitations, final state and remaining checks. All 161 i18n tests, the i18n checker, TypeScript with the documented 8 GB heap, and the seven-face/export font verifier pass again. No implementation or resource changes were needed during this resumed verification.

## Continuous verification — 2026-10-14

The i18n workflow now includes a Python job for the Amharic retained-source policy, fallback inventory and all seven UI font faces. `python scripts/report-amharic-coverage.py --check` validates resource/policy shape, rejects duplicate JSON keys and requires an up-to-date inventory without writing. Missing in-progress keys remain permitted; `--write` regenerates their reviewable inventory. The font verifier now checks decoded JSON values, including Unicode escapes. Ten verification-tool regressions cover invalid resources/policies, canonical changes, stale inventories and an escaped missing-glyph fixture. The language remains development-only; copy, source values and font assets are unchanged.
