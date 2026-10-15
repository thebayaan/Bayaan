# RFC-022: Amharic interface language in the existing i18n registry

| Field | Value |
| --- | --- |
| Status | Draft; implementation in progress, native/fluent/release review pending |
| Updated | 2026-10-13 |
| Branch | `feature/amharic-reading-controls`, based on `develop` at `6dd37983` |

## Decision

Follow [the upstream i18n guide](../i18n/README.md) and [Arabic support plan](../superpowers/plans/2026-10-12-arabic-support.md). Add Amharic as an `inProgress` registry entry and use the existing eight resource namespaces, language lifecycle, typed keys, CLDR helpers, polyfill and font aliases. The previous standalone framework design is superseded and preserved in the local backup; do not reintroduce its parallel store, instance or per-screen font hooks.

Amharic is LTR/Ethiopic with Western digits, English-side catalog metadata and English reading aids. The approved Bayaan display transliteration is **በያን**. A registry field supplies it at UI-only display sites; canonical configuration, fork names, identifiers, source content and outgoing share payloads stay original. English and Arabic remain the shipped languages.

## Protected content

This local diff does not edit Quran verses/translations, tafseer, word data, religious/reference names, selected editions, domain/provider services, stored user content, Quran renderer/Arabic fonts or playback behavior. New strings belong to the interface. Compare against the current develop base, since inherited upstream changes and historical SDK 56 evidence are not part of this feature's proof.

## Font choice

The upstream font registry requires Latin coverage for English catalog names. Original Noto Sans Ethiopic 2.102 files lack Latin letters. Seven reserved-name-safe OFL UI derivatives therefore retain each original Manrope face and add Ethiopic glyphs from the pinned Noto faces. Latin geometry, advances, line metrics and HarfBuzz sample shaping are checked independently; original assets are unchanged. [Build inputs, license, manifest and checks](../../assets/fonts/ethiopic/ui/README.md) are recorded. Native typography and size/startup review remain release gates.

## Coverage and acceptance

The unreviewed resources have 1,322 populated leaves across eight namespaces: 286 new interface drafts and 155 explicit original-source values join the preserved 881 entries. The 69 remaining source fallbacks are specialist reference descriptions/legend terminology, enumerated in the [per-key inventory](../i18n/amharic-fallbacks.md). The [source-value policy](../i18n/amharic-source-values.json) protects canonical catalog names, outgoing copy/share templates and numeric/reference notation. Missing draft strings are permitted only because the registry entry is in progress and development-only. Complete source-key, placeholder and plural checks, fluent review and real device checks are required before shipping.

The [implementation plan](../plans/2026-10-11-amharic-ui-localization.md) and [coverage/compliance record](../development/i18n-coverage.md) define the required tests and remaining work. Do not infer release readiness from static key coverage or a successful export.

RFC-021 belongs to native widget seams on the rebased develop branch; this Amharic RFC uses the next free number. No feature commit, push or PR was created.
