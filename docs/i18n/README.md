<!-- @ai-generated -->

# Internationalization (i18n)

How Bayaan's interface is translated, and the rules every change follows so a new language is a data change, not a code change.

Shipped languages: **English** (source) and **Arabic** (RTL). **Amharic** (LTR, Ethiopic) is an in-progress development-only draft. Every language the app knows about is listed once, in [`i18n/languages.ts`](../../i18n/languages.ts).

---

## Where things live

| What | Where |
|------|-------|
| Language registry (direction, script, digits, font, status) | `i18n/languages.ts` |
| Session language, preference, RTL bootstrap and reload | `i18n/language.ts` |
| i18next setup | `i18n/index.ts` |
| Locale files, one folder per language, one file per namespace | `i18n/locales/<lang>/<namespace>.json` |
| Namespace imports (English eager, others lazy) | `i18n/resources.ts` |
| Per-language name data | `i18n/packs.ts` |
| Display helpers: digits, numbers, surah and reciter names | `i18n/format.ts` |
| Tafsir edition titles and language labels | `i18n/tafseer.ts` |
| UI fonts per language | `i18n/fonts.ts` |
| RTL helpers (`flipX`, `forceLTR`, `latinLetterSpacing`) | `utils/rtl.ts` |
| CLI config for the CI checks | `i18next.config.ts` |
| Tests that enforce the rules below | `i18n/__tests__/` |

The stack is `i18next` + `react-i18next`, `expo-localization` for the device language, and the `intl-pluralrules` polyfill, because Hermes has no `Intl.PluralRules`. Don't remove the polyfill: without it Arabic plurals render wrong.

---

## The rules

1. **No hardcoded UI text.** Every string a user can see or hear goes through `t()`. That includes `accessibilityLabel`, `placeholder`, `Alert.alert` titles and toasts. Dev-only screens are the only exception (see `lint.ignore` in `i18next.config.ts`, or put a `// i18next-instrument-ignore` comment on the line before the element). The lint step only sees literal text in JSX (`<Text>`, `<TextInput>`, `<Button>` and the props listed in the config), so strings in template literals, `Alert.alert` and `showToast` are on you and the reviewer.
2. **Ask the registry, never the language code.** Write `currentLanguageConfig.direction === 'rtl'` or `getLanguageConfig(language).digits`, not `currentLanguage === 'ar'`. If no property fits, add one to `LanguageConfig` with a doc comment and set it for every language. The only code comparison allowed is against `SOURCE_LANGUAGE` (English), for strings that are their own English labels.
3. **Quran text and names are data, not UI strings.** Quran text, Arabic surah names and reciter names never go in locale files and never go through machine translation. Surah names come from `data/surahData`; reciter names come from the API (see [Names and other data](#names-and-other-data)).
4. **Every key goes into every shipped language in the same PR.** The locale tests fail if a shipped language is missing a key, has an extra one, or has an empty value.
5. **Plurals use `count`, never `n === 1 ? ... : ...`.** Each language defines all of its CLDR plural categories (see [Plurals](#plurals)).
6. **Interpolate, don't concatenate.** Use one key with placeholders (`"Loading the {{rewayah}} text"`), not `t('loading') + ' ' + name`. Word order differs between languages.
7. **Format numbers and dates through the helpers.** `localizeDigits` and `formatNumber` for digits, `decimalSeparator()` for decimals, and `getIntlLocale(language)` for `Intl` and `toLocaleDateString`.
8. **Mirror direction, not media.** Directional icons (back arrows, chevrons) use `flipX`. Playback controls, scrubbers and anything drawn with physical coordinates stay left to right with `forceLTR`.
9. **No letter spacing on cursive scripts.** Wrap `letterSpacing` values in `latinLetterSpacing()`; it returns 0 for languages whose script joins letters.
10. **Escape before HTML.** i18next runs with `escapeValue: false` because React Native `<Text>` never interprets markup. Any translation or API name that goes into HTML, a WebView or Markdown must be escaped at that point.
11. **Case and sort with the locale.** Use `toLocaleUpperCase(getIntlLocale(currentLanguage))` and `localeCompare(other, getIntlLocale(currentLanguage))`, never the locale-free versions (Turkish dotted i, German ß).
12. **Treat API names as untrusted.** Reciter `names` from the API pass through `sanitizeDisplayNames` (`i18n/names.ts`): supported languages only, NFC, at most 120 characters, no control or bidi characters.

---

## Adding or changing a string

1. Pick the namespace by where the string appears:

   | Namespace | For |
   |-----------|-----|
   | `common` | Shared actions (`actions.tryAgain`), tab names, shared terms, status text |
   | `home` | Home, browse, reciter cards, tafsir catalogue labels |
   | `collection` | Collection screens: loved, downloads, playlists, notes, uploads |
   | `settings` | Settings screens, including mushaf settings |
   | `sheets` | Bottom sheets: verse actions, share, copy, playback options |
   | `player` | The player, queue and reciter profile |
   | `reader` | The mushaf reader and verse lists |
   | `content` | Onboarding, system playlists, units, adhkar titles, long copy |

   Reuse an existing key before adding one (`common:actions.*`, `common:terms.*`).
2. Name keys by screen, then element: `communityReflections.loadFailed`, not `error1`. Use camelCase.
3. Add the English value and the value for every shipped language.
4. Use it: `const {t} = useTranslation(['sheets', 'common']);` then `t('verseActions.loadingText', {rewayah: label})`. List every namespace the component reads from, or the typed `t` rejects keys from the others.
5. Run `npm run i18n:check` and `npx jest i18n/`.

If you can't write a good translation yourself, ask for help in the PR. A machine draft is acceptable only when it's marked as a draft for native review (see [Translating](#translating)).

---

## Plurals

i18next picks a plural form from the language's CLDR rules and looks up `key_<category>`:

| Language | Categories |
|----------|------------|
| English | `one`, `other` |
| Arabic | `zero`, `one`, `two`, `few` (3 to 10, and 103 to 110 and so on), `many` (11 to 99, 111 to 199 and so on), `other` (100, 101, 102 and so on) |
| Amharic | `one` (0 and 1), `other` |
| French | `one` (0 and 1), `many` (large round numbers such as 1,000,000), `other` |

Write all of them for every plural key. For example, `sheets.json`:

```json
"count_one": "{{count}} reflection",
"count_other": "{{count}} reflections"
```

```json
"count_zero": "لا توجد تدبّرات",
"count_one": "تدبّر واحد",
"count_two": "تدبّران",
"count_few": "{{count}} تدبّرات",
"count_many": "{{count}} تدبّرًا",
"count_other": "{{count}} تدبّر"
```

```tsx
t('communityReflections.count', {count: reflections.length});
```

A form may leave out `{{count}}` when the word already says the number (`تدبّران` means "two reflections").

---

## Right-to-left

- **Layout flips on its own.** `i18n/language.ts` turns on RTL with `I18nManager.forceRTL`. In RTL, `flexDirection: 'row'` runs right to left, and with `swapLeftAndRightInRTL(true)` (the default, set explicitly) `marginLeft`, `paddingLeft` and absolute `left`/`right` swap sides. `textAlign: 'left'` follows the text's direction, so it aligns to the right in Arabic. Don't add `row-reverse` or swap margins by hand to fix RTL.
- **These don't flip:** `transform: [{translateX}]`, Animated slide directions, gesture `dx` values and horizontal `ScrollView` offsets on Android. Check them in Arabic and negate where needed.
- **A direction change needs a reload.** `setLanguagePreference` restarts the app when the direction changes. `currentLanguage` is fixed for the session.
- **Mirror directional icons** with `flipX`: back buttons, chevrons, "next" arrows.
- **Don't mirror** media transport (play, skip, rewind), playback progress bars, clocks, checkmarks, logos, or the Quran page itself. Wrap media controls and sliders in `forceLTR`. Material Design and Apple's HIG both say to keep these left to right.
- **Horizontal `FlatList`s** follow the native direction even inside `forceLTR`; check their scroll and index logic in Arabic.
- **Mixed-direction strings.** A Latin name inside an Arabic sentence (or the reverse) can scramble the punctuation around it. Wrap the inserted value in Unicode isolates, FSI (`\u2068`) and PDI (`\u2069`), when that happens. Don't use the older LRE/RLE characters.

---

## Numbers, dates and fonts

- **Digits.** Arabic UI text uses Arabic-Indic digits (`٣`), applied by a postprocessor in `i18n/index.ts` and by `localizeDigits`. The digits come from the registry's `digits` field. Note that CLDR's defaults depend on the region: plain `ar` and North African locales (`ar-MA`, `ar-DZ`, `ar-TN`) use Western digits. If we ever follow the region, read it from `expo-localization` rather than the language code.
- **Hermes limits.** No `Intl.PluralRules` (we polyfill it), and `-u-nu-` numbering overrides are not reliable on iOS (observed, not documented). That's why digits are swapped by `localizeDigits` and separators come from the registry instead of `Intl.NumberFormat`.
- **Separators.** `groupSeparator` and `decimalSeparator` in the registry must match CLDR for the language's digits (French uses a narrow no-break space and a comma, Indonesian and Turkish a dot and a comma). The registry test compares them with `Intl.NumberFormat`.
- **Dates.** Use `getIntlLocale(language)` with `toLocaleDateString` or `Intl.DateTimeFormat`, then pass the result through `localizeDigits` so dates use the same digits as the rest of the UI.
- **Fonts.** The UI is styled with `Manrope-*` family names. `i18n/fonts.ts` maps those names to the font listed as the language's `uiFont`, so styles never change per language. Arabic uses IBM Plex Sans Arabic. A new script needs a font that covers it; the registry test checks the mapping. Quran text always renders with Digital Khatt, never a UI font.

---

## Names and other data

UI strings live in locale files. Content that comes with the data has its own rules:

| Data | Rule |
|------|------|
| Surah names | `getSurahDisplayName`: the Arabic name for languages whose `bilingualContent` is `'ar'`; otherwise a bundled phonetic spelling in the language's own script when one exists (`data/surahNamesAm.json` for Amharic, registered in `i18n/format.ts`), else the Latin transliteration. Names are transliterated from the Arabic, never translated by meaning. The meaning (`getSurahMeaning`) shows in every language except Arabic: translated where a bundled file exists (`data/surahMeaningsAm.json` for Amharic, taken from the chapter list at amharicquran.com, pending review), else in English. Surah search also matches the bundled spellings. |
| Reciter names | `getReciterDisplayName`: first a spelling in the language's own script, from the API's `names[<language>]` (bayaan-backend `reciters.names`) and then the bundled `data/reciterNames<Lang>.json` registered in `i18n/format.ts` (Amharic has one). Then, for languages whose `bilingualContent` is `'ar'`, the API's `name_arabic` and the bundled `data/reciterNamesAr.json`; otherwise the English name. Reciter search matches every spelling. Reciter names are transliterated, never translated. Load a bundled file into the backend with `scripts/import-reciter-names.ts` there. |
| Tafsir editions | Titles come from `home.tafseerNames` in the active locale, then the edition's Arabic or English name (by `bilingualContent`). |
| Adhkar categories | `getSuperCategoryDisplayTitle` reads `content:adhkarSuperCategories.<id>`, keyed by the seeded super-category id, and falls back to the database's Arabic or English title (by `bilingualContent`). Add a key in every shipped language when seeding a new super category. |
| User uploads | Shown exactly as the user named them. |

When a backend field exists only in Arabic and English, the registry's `bilingualContent` decides which one a language shows.

---

## Adding a language

1. **Registry.** Add the code to `SUPPORTED_LANGUAGES` and an entry to `LANGUAGES` in `i18n/languages.ts` with `status: 'inProgress'`. The endonym, script, direction and separators must match CLDR; `npx jest i18n/__tests__/languages.test.ts` checks them. For the policy fields:
   - `digits`: the CLDR default for the bare language (`new Intl.NumberFormat(code).resolvedOptions().numberingSystem`) unless there's a product reason. A new numbering system needs an entry in `DIGIT_ZERO`.
   - `bilingualContent`: `'ar'` if readers expect Arabic surah names (Urdu, Persian), otherwise `'en'`.
   - `understandsArabic`: `true` only if readers understand Quranic Arabic without a translation (Arabic itself).
2. **Locale files.** Create `i18n/locales/<code>/` with every namespace file and add one loader for them to `LOADERS` in `i18n/resources.ts` (it is required lazily, so other languages' users never evaluate it). Per-language name data (surah names, meanings, reciter names in the language's script) goes in one entry in `i18n/packs.ts`. While the language is in progress, missing or empty keys fall back to English, CI doesn't require them, and the language only appears in development builds.
3. **Platform settings (at ship time).** Add the code to `supportedLocales.ios` in `app.config.js` so the language appears in iOS's per-app language settings; the registry test requires it for shipped languages. Consider `supportedLocales.android` for Android 13+ per-app languages too.
4. **Font.** If the script is new, bundle a font that covers it, add it to `UiFont` and `i18n/fonts.ts`, and add the script to `FONT_SCRIPTS` in the registry test. For Amharic (Ethiopic script), use Noto Sans Ethiopic, which is under the OFL licence. `python scripts/verify-i18n-ui-fonts.py --language <code>` then checks that every face covers the language's locale files and bundled name data.
5. **Plurals.** Write every CLDR category the language has for each plural key (the locale tests list them), and no others (the hygiene test rejects extras).
6. **Glossary.** Add a column to the [glossary](#glossary) and follow it.
7. **Review.** A native speaker reviews every string, machine-drafted or not. LLMs translate noticeably worse into low-resource languages such as Amharic.
8. **Check on a device.** Look at Home, the player, the mushaf, settings and a few sheets with the language selected.
9. **Inventory.** Run `python scripts/report-i18n-coverage.py --language <code> --write` and commit the generated `docs/i18n/<name>-fallbacks.md`; CI checks every registry language with `--check`. If some keys must keep the English value byte for byte (canonical names, copied/shared templates, notation), list them in `docs/i18n/<name>-source-values.json` under `catalogNames`, `canonicalOutputs` or `notation`; without that file no value is retained deliberately.
10. **Ship.** Set `status: 'shipped'` once the language is complete. From then on the tests and CI require every key.

Native surfaces (widgets, CarPlay, Android Auto) are outside this system; check them separately.

---

## Checks

| Command | What it does | In CI |
|---------|--------------|-------|
| `npm run i18n:check` | Fails if code uses a key that the English files or a shipped language lack, or if JSX text is hardcoded (see rule 1 for what it can't see) | Blocking |
| `npx jest i18n/` | Registry matches CLDR; shipped languages have every key; every language has its plural categories and the same placeholders as English | Blocking (Test workflow) |
| `npx jest i18n/__tests__/localeHygiene.test.ts` | Every locale file of every language, plus the bundled `data/*Am.json` and `data/reciterNamesAr.json` names: no bidi controls (U+202A–202E, U+2066–2069, LRM/RLM), zero-width characters, BOM or control characters other than `\n`; every key uses the same `<tag>` markup as English; no plural categories the language lacks | Blocking (Test workflow) |
| `python scripts/report-i18n-coverage.py --check` | For every non-source language in the registry (or `--language <code>`, repeatable): JSON/resource validity, the optional retained-source policy `docs/i18n/<name>-source-values.json` and that `docs/i18n/<name>-fallbacks.md` matches current resources (`<name>` is the lower-case English name, e.g. `amharic`, `arabic`); permits documented in-progress fallbacks | Blocking for Amharic (CI runs the `report-amharic-coverage.py` alias); run locally for other languages |
| `python scripts/verify-i18n-ui-fonts.py` | For every non-source language: each character of its own script, ASCII and shared punctuation in its decoded locale JSON and bundled data (`data/<name><Code>.json` loaded by `i18n/*.ts`) has a glyph in every face of its `uiFont` (resolved through `i18n/fonts.ts`). Other scripts and emoji are left to platform fallback and only counted. For the Ethiopic derivatives it also runs `scripts/verify-ethiopic-ui-fonts.py`: pinned font hashes and original Latin glyphs/metrics/shaping (`--export-dir` checks exported bytes) | Ethiopic part blocking (CI runs `verify-ethiopic-ui-fonts.py`); run locally for other languages |
| `npm run i18n:status` | Translation progress for shipped languages (in-progress languages are left out of the CLI config) | Advisory |
| `npm run i18n:unused` | Keys no code references. Keys built at runtime (`` `ambient.sounds.${id}` ``) show up too, so check before deleting | Advisory |

The workflow is `.github/workflows/i18n.yml`. The CLI never deletes keys on its own (`removeUnusedKeys: false`).

The `amharic` job uses Python 3.12 and the hash-pinned dependencies in `scripts/rewayah/requirements-ci.txt`, and runs the Amharic aliases of these scripts. Both general scripts read the language list from `i18n/languages.ts`; when a second in-progress language needs the CI gate, point the job at them. When resources change, run `python scripts/report-i18n-coverage.py --write` (all languages, or `--language <code>`) and review the inventory diff before committing. The `--check` mode writes nothing and fails with the regeneration command if an inventory is stale. It does not require an in-progress language to be complete. `scripts/report-amharic-coverage.py` remains as an alias for `--language am`. Verification-tool regressions run with `python -B -m unittest discover -s scripts/__tests__ -p 'test_i18n_*.py'`.

---

## Translating

- **Who:** native speakers, credited in the PR. AI drafts are welcome as a starting point, but say so in the PR and get a native review before merging.
- **Consistency:** follow the glossary. Where a language has its own established word, use it (French "Sourate", Urdu "پارہ" for Juz); otherwise keep the transliteration.
- **Tone:** plain and respectful. Short labels for buttons; full sentences for messages.

### Glossary

Canonical terms. The keys under `common.terms.*` are the reference values.

| English | Arabic | Amharic draft — native review pending | Notes |
|---------|--------|----------------------------------------|-------|
| Surah | سورة | ሱራ | Plural السور |
| Ayah | آية | አንቀጽ | Plural آيات. Use "Ayah" in English UI; "verse" only in longer sentences |
| Juz | جزء | ጁዝ |  |
| Hizb | حزب | ሂዝብ |  |
| Tafseer | التفسير | ተፍሲር | English UI spells it "Tafseer" (`common.terms.tafseer`) |
| Rewayah | الرواية | ሪዋያ | Plural Rewayat / الروايات |
| Reciter | القارئ | አንባቢ | Some languages use "Qari" (Malay, Indonesian, Urdu) |
| Mushaf | المصحف | ሙስሐፍ |  |
| Adhkar | الأذكار | አዝካር | Singular Dhikr / ذكر |
| Bismillah | البسملة | ቢስሚላህ |  |
| Murattal | مرتل | ሙረተል | Recitation style |
| Mojawwad | مجوّد | ሙጀወድ | Recitation style |
| Word by Word | كلمة بكلمة | ቃል በቃል |  |
| Transliteration | النطق اللاتيني | የፊደል ቅየራ |  |
| Follow Along | المتابعة مع التلاوة | አብሮ መከተል | Verse highlighting during playback |


### Amharic development draft

The Amharic draft follows the existing registry and eight namespaces; it does not add a second language store, i18next instance, plural implementation or per-screen font system. It has `status: 'inProgress'`, Western digits and separators, English-side catalog names, and OFL UI derivatives combining the existing Manrope faces with Noto Sans Ethiopic 2.102 under the UI font aliases. Missing draft keys fall back to English. English and Arabic source/shipped resources are unchanged.

`LanguageConfig.bayaanTransliteration` supplies the approved display spelling **በያን**. `getAppDisplayName` uses that registry property only for the canonical Bayaan brand, keeping fork names, canonical configuration, identifiers and share payloads intact. Existing English/Arabic brand behavior is preserved. This is a transliteration, not a translation of the word's meaning.

Draft copy and the glossary column above require fluent-speaker review. The [Amharic plan](../plans/2026-10-11-amharic-ui-localization.md) and [coverage/compliance record](../development/i18n-coverage.md) track unfinished keys and release checks. The [per-key fallback inventory](amharic-fallbacks.md) distinguishes pending interface copy from canonical references and material requiring separate terminology/religious review. Do not mark the language shipped or add native released-language declarations before those checks pass.
