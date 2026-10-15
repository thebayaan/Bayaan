<!-- @ai-generated -->

# French interface localization: plan

| Field | Value |
| --- | --- |
| Status | Development draft. Native review and device QA pending |
| Updated | 2026-10-15 |
| Branch | `feature/french-ui-localization`, from `develop` at `b31362cf` |
| Governing guide | [i18n guidelines](../i18n/README.md) |
| Reference implementations | [Arabic plan](../superpowers/plans/2026-10-12-arabic-support.md); the Amharic draft on `feature/amharic-reading-controls` |

## Goal and boundary

Bayaan's interface can run in French. This is interface translation only:

- No Quran text, translations, tafsir, adhkar bodies or word data change.
- No French Quran edition is selected automatically.
- Names stay as data: reciters, surah transliterations, rewayat, editions and the brand "Bayaan".

French follows the Arabic architecture: the same registry, the eight namespaces, fixed-session language, reload on change, typed keys, the CLDR helpers and the `intl-pluralrules` polyfill. Nothing here adds a parallel mechanism.

## Decisions

| Topic | Decision |
| --- | --- |
| Registry | `fr` in `i18n/languages.ts`. The settings are `status: 'inProgress'`, LTR, `Latn`, Western digits, `bilingualContent: 'en'` and `understandsArabic: false`. In-progress languages appear only in development builds, and missing keys fall back to English. |
| Separators | CLDR: narrow no-break space (U+202F) for grouping and a comma for decimals. The registry test checks them against `Intl.NumberFormat`. |
| Plurals | `one` (0 and 1), `many` (large round numbers such as 1 000 000), `other`. Every plural key defines all three. |
| Font | Manrope. It covers all French letters, « », ’ and U+00A0. It lacks U+202F, so the group separator renders from the platform's fallback font. Check this on devices. |
| Surah names | The Latin transliteration, the same as English. The English meaning ("The Opener") is shown only in English, which matches the Amharic branch. |
| Reciter names | The Latin name the API already serves. The per-language `names` map being added for Amharic falls back to it, so French needs no data of its own. |
| Reading aids | English translation and transliteration default on, because `understandsArabic` is false. This is unchanged registry behavior. |
| Outgoing text | Share and copy messages are translated, since a French user sends them. Quran references and verse keys keep their notation. |
| Backend | No change is needed for French. See [Backend](#backend). |
| iOS / Android | `supportedLocales.ios` gets `fr` only at ship time; the registry test enforces this for shipped languages. Android 13+ per-app languages are optional. |

## Style

Drafts follow these rules, which were also given to the translators. A reviewer checks them.

- **Register and case**
  - Formal "vous".
  - Sentence case for titles and buttons.
  - No inclusive-writing forms.
- **Punctuation and typography**
  - Typographic apostrophe ’ in French words. Transliterated names keep the ASCII ' as in English, as in "Hafs 'an Asim".
  - A no-break space (U+00A0) before `:` `;` `!` `?` `%` and inside « ».
  - Guillemets for quotations, and … for ellipsis.
- **Religious terms**
  - "Allah", never "Dieu". Honorifics are copied exactly as in English.
  - The glossary column in the [i18n guide](../i18n/README.md#glossary) is canonical, and `common.terms.*` holds the reference values. Other terms are listed below.
- **Other terms**
  - Récitation, Tajwid, Playlist, Signet, Favoris, Imports (user audio), File d’attente, Accueil, Rechercher, Paramètres, Lecteur and Sons d’ambiance.
  - Units are Go, Mo and Ko.
- **Rewayat and tajweed explanations** are translated faithfully, keeping the Arabic technical terms transliterated as in English. They need specialist review before shipping (see the release gates).

## Implementation

1. Registry, resources and tests: `i18n/languages.ts`, `i18n/resources.ts`, `i18n/__tests__/`.
2. Locale files `i18n/locales/fr/<namespace>.json`, covering all eight namespaces and every key.
3. `getSurahMeaning` shows the English meaning only in English.
4. Docs: the glossary column, this plan, and the in-progress note in the guide.

## Backend

`bayaan-backend` needs no change for French.

- **What Arabic changed.** Arabic's only server-side dependency was the optional reciter `name_arabic`.
- **French names.** French shows the same Latin reciter and surah names the API already returns.
- **Share previews.** The link-preview images rendered by `src/routes/og` are English. Shared links go to people whose language is unknown, so they stay as they are unless the owner asks otherwise.
- **Reciter `names` map.** The Amharic work is adding a per-language `names` map to reciters. When it lands, French reads `names.fr` if anyone adds one, then falls back to the English name. No French-specific code is needed for that.

## Verification

- `npm run i18n:check`
- `npx jest i18n/`, which covers:
  - the registry against CLDR
  - same keys and placeholders as English
  - all three French plural categories
  - development-only availability
  - reload and direction when switching to and from Arabic
- `npx tsc --noEmit` and ESLint on the changed files.
- A full Jest run with `BAYAAN_OVERLAY_DB_DIR=bundled`.

## Release gates (not done)

1. Fluent French review of every string, ideally by a French-speaking Muslim. Specifically:
   - the glossary choices (Verset vs Ayah, Riwaya, Basmala)
   - the register
   - North African versus European usage
2. Specialist review of the rewayat, qira'at and tajweed explanations, in `settings:mushafSettings.*` and `content:rewayat.*`. Warsh matters most for Maghrebi readers.
3. Device QA on iOS and Android:
   - Home, the player, the mushaf, settings and sheets
   - truncation, since French runs about 20% longer than English
   - accessibility font sizes
   - the narrow no-break space in grouped numbers
4. Then add `fr` to `supportedLocales.ios` and set `status: 'shipped'`. From then on, CI requires every key.

## Merging with the Amharic branch

Both branches add an entry to the registry, `resources.ts` and the glossary table, so expect small textual conflicts there. Keep both sides. The Amharic branch also adds new `content` keys, such as `adhkarSuperCategories`. When it lands in `develop`, French needs those keys translated, and the locale tests list any that are missing.
