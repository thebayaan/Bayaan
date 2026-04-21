# Translations & Tafaseer Integration Research Report

**Date:** February 2026
**Status:** Research Complete — Awaiting Decision
**Scope:** Adding multi-translation and tafseer support to Bayaan

---

## Executive Summary

Bayaan already has working translation infrastructure (Saheeh International + Clear Quran bundled, inline display in VerseItem, TranslationContent sheet). The work is **not greenfield** — it's about making the hardcoded system dynamic and extensible.

Three viable API sources exist. The recommended approach is a **hybrid strategy**: use the free, no-auth **Al Quran Cloud API** as the primary data source (101 translations, simple REST), with pre-bundled Saheeh International for offline-first, and SQLite + FTS5 for local storage of downloaded translations. Tafaseer should be API-only due to their massive size (500MB-5GB each).

**Estimated effort:** 3 phases over ~2-3 sprints
**Estimated cost:** $0-8/month (Supabase optional)

---

## 1. API Source Comparison

### Available APIs

| | **Al Quran Cloud** | **Quran Foundation (quran.com)** | **fawazahmed0 CDN** | **Tarteel QUL** |
|---|---|---|---|---|
| **Translations** | 101 | 74 | 440+ | 193 (download only) |
| **Tafaseer** | 6 (Arabic only) | 20 (multi-language) | Limited | 114 (download only) |
| **Languages** | 40+ | 50+ | 90+ | Multi |
| **Auth Required** | None | OAuth2 (1hr tokens) | None | N/A (no API) |
| **Rate Limits** | Standard | Token-based | CDN-backed | N/A |
| **Format** | Plain text JSON | HTML with footnotes | Plain text JSON | SQLite/JSON files |
| **Bulk Download** | Full surah in 1 call | Max 50 verses/page | Full files on CDN | Download packages |
| **Reliability** | High (established) | High (official) | Medium (community) | N/A |
| **Cost** | Free | Free (content tier) | Free | Free |

### Recommendation: Al Quran Cloud API (Primary) + Quran Foundation (Tafaseer)

**Why Al Quran Cloud for translations:**
- No authentication required (no OAuth2 token management)
- 101 translations across 40+ languages — sufficient coverage
- Plain text responses (no HTML parsing needed for most translations)
- Simple REST: `GET /v1/surah/{surah}/{edition}` returns all verses
- Bulk-friendly: one call per surah (no pagination needed)
- Battle-tested, stable API

**Why Quran Foundation for tafaseer:**
- 20 tafaseer in multiple languages (English, Arabic, Bengali, Urdu, Kurdish, Russian)
- Al Quran Cloud only has 6 tafaseer, all in Arabic
- OAuth2 is acceptable for tafaseer since they're API-only (not downloaded)
- Rich metadata (verse grouping, chapter context)

**Why NOT fawazahmed0:**
- Community-maintained, some OCR errors reported
- 440+ translations but quality varies significantly
- CDN-based (GitHub + jsDelivr) — less reliable than dedicated API

**Why NOT Tarteel QUL:**
- No API exists — download-only resource hub
- Would need to self-host all data
- Better for pre-bundling specific datasets than live integration

---

## 2. Available Content Catalog

### Translations (via Al Quran Cloud — 101 total)

| Language | Count | Notable Translations |
|---|---|---|
| English | 11+ | Sahih International, Pickthall, Yusuf Ali, Arberry, Maududi, Hilali-Khan, Itani |
| Persian/Farsi | 11 | Fooladvand, Makarem, Ansarian, Ghomshei |
| Turkish | 10 | Diyanet, Yazir, Yuksel, Golpinarli |
| Urdu | 8 | Jalandhry, Maududi, Junagarhi, Kanzuliman |
| Russian | 8 | Kuliev, Osmanov, Porokhova, Sablukov |
| Spanish | 4 | Cortes, Garcia, Bornez |
| Albanian | 3 | Ahmeti, Mehdiu, Nahi |
| Bengali, French, German, Indonesian, Italian, Malay, Portuguese, etc. | 1-3 each | Various established translators |
| **Total** | **101** | **40+ languages** |

### Tafaseer (via Quran Foundation — 20 total)

| Language | Count | Notable Tafaseer |
|---|---|---|
| Arabic | 6 | Ibn Kathir, Tabari, Qurtubi, Sa'di, Baghawi, Wasit (Tantawi), Muyassar |
| Bengali | 4 | Tafsir Abu Bakr Zakaria, Ahsanul Bayaan, Fathul Majid, Ibn Kathir |
| Urdu | 4 | Fi Zilal al-Quran (Qutb), Bayan ul Quran (Israr Ahmad), Ibn Kathir, Tazkir |
| English | 3 | Ibn Kathir (Abridged), Ma'arif al-Qur'an (Shafi), Tazkirul Quran |
| Russian | 1 | Al-Sa'di |
| Kurdish | 1 | Rebar Kurdish Tafsir |

### Supplementary: Al Quran Cloud Tafaseer (6, Arabic only)

Jalalayn, Qurtubi, Muyassar, Tanwir al-Miqbas, Waseet, Baghawi

---

## 3. Data Schema & Footnote Format

### Al Quran Cloud Response (Translation)

```
GET https://api.alquran.cloud/v1/surah/1/en.sahih
```

```json
{
  "code": 200,
  "status": "OK",
  "data": {
    "number": 1,
    "name": "سُورَةُ ٱلْفَاتِحَةِ",
    "englishName": "Al-Faatiha",
    "numberOfAyahs": 7,
    "revelationType": "Meccan",
    "ayahs": [
      {
        "number": 1,           // Global ayah number (1-6236)
        "text": "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
        "numberInSurah": 1,
        "juz": 1,
        "manzil": 1,
        "page": 1,
        "ruku": 1,
        "hizbQuarter": 1,
        "sajda": false
      }
    ],
    "edition": {
      "identifier": "en.sahih",
      "language": "en",
      "name": "Saheeh International",
      "englishName": "Saheeh International",
      "format": "text",
      "type": "translation",
      "direction": "ltr"
    }
  }
}
```

**Key advantages:**
- Plain text (no HTML parsing needed)
- Full surah in one call (no pagination)
- Clean verse numbering (both global and in-surah)
- Edition metadata included

### Quran Foundation Response (Translation with Footnotes)

```
GET https://api.quran.com/api/v4/verses/by_key/2:255?translations=20&fields=text_uthmani
```

```json
{
  "verse": {
    "id": 262,
    "verse_number": 255,
    "verse_key": "2:255",
    "hizb_number": 5,
    "rub_el_hizb_number": 17,
    "page_number": 42,
    "juz_number": 3,
    "text_uthmani": "ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ...",
    "translations": [
      {
        "id": 97729,
        "resource_id": 20,
        "text": "Allāh - there is no deity except Him, the Ever-Living,<sup foot_note=196031>1</sup> the Sustainer of [all] existence.<sup foot_note=196030>2</sup>"
      }
    ]
  }
}
```

**Footnote format:** `<sup foot_note={id}>{number}</sup>`
- Footnotes are inline HTML in the `text` field
- `foot_note` attribute contains a numeric ID (can fetch full footnote text via separate endpoint)
- Requires HTML stripping or rendering

### Quran Foundation Response (Tafsir)

Tafsir text is HTML-formatted with `<p>`, `<h2>`, `<ol>` tags. Entries can be very long (1000+ words for detailed verses). Tafsir entries may span multiple verses (verse grouping).

---

## 4. Storage Architecture

### Decision: SQLite + On-Demand Downloads

| Data Type | Storage | Rationale |
|---|---|---|
| **Saheeh International** | Pre-bundled JSON (existing) | Already in app, ~3MB, offline-first |
| **Downloaded translations** | SQLite (`translations.db`) | Structured queries, FTS5 search, ~3-5MB each |
| **Translation metadata** | MMKV (existing pattern) | Fast sync reads for settings/UI |
| **User preferences** | AsyncStorage via Zustand (existing) | Selected translation, show/hide toggles |
| **Tafaseer** | API-only (no local storage) | 500MB-5GB each — impractical for mobile |
| **Tafseer cache** | MMKV with TTL | Cache recently viewed verses (24hr TTL) |

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surah_number INTEGER NOT NULL,
  verse_number INTEGER NOT NULL,
  translation_id TEXT NOT NULL,          -- e.g., "en.sahih"
  text TEXT NOT NULL,
  UNIQUE(surah_number, verse_number, translation_id)
);

CREATE TABLE IF NOT EXISTS translation_metadata (
  id TEXT PRIMARY KEY,                   -- e.g., "en.sahih"
  name TEXT NOT NULL,                    -- "Saheeh International"
  language_code TEXT NOT NULL,           -- "en"
  language_name TEXT NOT NULL,           -- "English"
  author TEXT,                           -- "Saheeh International"
  direction TEXT DEFAULT 'ltr',          -- "ltr" or "rtl"
  size_bytes INTEGER,
  downloaded_at INTEGER,
  last_accessed_at INTEGER,
  is_preinstalled INTEGER DEFAULT 0
);

-- Full-text search for verse lookup
CREATE VIRTUAL TABLE IF NOT EXISTS translations_fts USING fts5(
  text,
  content=translations,
  content_rowid=id
);

-- Keep FTS in sync
CREATE TRIGGER translations_ai AFTER INSERT ON translations BEGIN
  INSERT INTO translations_fts(rowid, text)
  VALUES (new.id, new.text);
END;

CREATE TRIGGER translations_ad AFTER DELETE ON translations BEGIN
  INSERT INTO translations_fts(translations_fts, rowid, text)
  VALUES('delete', old.id, old.text);
END;
```

### Data Size Budget

| Scenario | Storage Used |
|---|---|
| App baseline (no extra translations) | ~3MB (bundled Saheeh) |
| + 1 additional translation | ~6-8MB |
| + 5 translations (typical user) | ~18-28MB |
| + 10 translations (power user) | ~33-53MB |
| Tafseer cache (MMKV, 100 verses) | ~500KB |

### Cost (if using Supabase as CDN)

| Component | Monthly Cost |
|---|---|
| Supabase Storage (pre-packaged translations) | $0.50 |
| CDN egress | $2-3 |
| **Total** | **$3-5/month** |

**Alternative: $0/month** — Call Al Quran Cloud API directly, cache to SQLite on-device. No Supabase needed for translations.

---

## 5. Existing Codebase Integration Points

### What Already Exists

| Component | File | Status |
|---|---|---|
| Bundled Saheeh International | `data/SaheehInternational.translation-with-footnote-tags.json` | Working |
| Bundled Clear Quran | `data/clear-quran-translation.json` | Working |
| Bundled Transliteration | `data/transliteration.json` | Working |
| Pre-computed verse data | `utils/enhancedVerseData.ts` | Hardcoded to Saheeh |
| Inline translation in player | `components/player/v2/PlayerContent/QuranView/VerseItem.tsx` | Hardcoded label |
| Translation sheet | `components/sheets/verse-actions/TranslationContent.tsx` | 2 hardcoded tabs |
| Verse actions menu | `components/sheets/VerseActionsSheet.tsx` | Has "Translation" in EXPLORE |
| Settings toggle | `store/mushafSettingsStore.ts` | `showTranslation`, `translationFontSize` |
| Reading mode | `components/mushaf/reading/ReadingPageView.tsx` | Passes translation props |

### What Needs to Change

| Change | File | Description |
|---|---|---|
| Add `selectedTranslation` field | `store/mushafSettingsStore.ts` | Currently no way to choose which translation |
| Make translation source dynamic | `utils/enhancedVerseData.ts` | Line 49 hardcoded to Saheeh |
| Dynamic translation label | `VerseItem.tsx` | Line 432 hardcodes "Saheeh International" |
| Multi-source TranslationContent | `TranslationContent.tsx` | Replace 2-tab hardcoded switcher |
| Add "Tafseer" action | `VerseActionsSheet.tsx` | New entry in EXPLORE section |
| New TafseerContent component | `components/sheets/verse-actions/` | New file needed |
| Translation settings screen | `app/(tabs)/(a.home)/settings/` | New `translations.tsx` route |
| Translation download service | `services/translation/` | New service for API + SQLite |
| Register in AppInitializer | `services/AppInitializer.ts` | Priority 10 (non-critical) |

---

## 6. UX Flow Recommendation

### Where Translations Live in the App

**A. Settings > Quran > Translations** (management)
```
Settings
├── Quran
│   ├── Mushaf Settings
│   ├── Translations          <-- NEW
│   │   ├── [Search bar]
│   │   ├── Active Translation: Saheeh International ✓
│   │   ├── Downloaded
│   │   │   ├── Saheeh International (English) — 3.2MB ✓ [pre-installed]
│   │   │   └── Pickthall (English) — 2.8MB [delete]
│   │   ├── Available by Language
│   │   │   ├── English (11)
│   │   │   ├── Turkish (10)
│   │   │   ├── Urdu (8)
│   │   │   └── ... 40+ languages
│   │   └── Storage Used: 6.0 MB
│   └── ...
```

**B. Verse Actions Sheet** (contextual access)
```
[Long-press verse]
├── ACTIONS
│   ├── Copy
│   ├── Share
│   └── Bookmark
├── EXPLORE
│   ├── Translation     <-- existing, make dynamic
│   ├── Tafseer          <-- NEW
│   └── Word by Word     <-- future
```

**C. Inline during playback** (quick toggle)
- Translation text shown below Arabic verse (existing behavior)
- Tap translation source label to switch between downloaded translations
- Toggle on/off via existing mushaf settings

### Translation Selection Screen Design

```
┌─────────────────────────────┐
│ ← Translations              │
├─────────────────────────────┤
│ 🔍 Search translations...   │
├─────────────────────────────┤
│ ACTIVE TRANSLATION          │
│ ┌─────────────────────────┐ │
│ │ Saheeh International    │ │
│ │ English · Pre-installed │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ DOWNLOADED                  │
│ ┌─────────────────────────┐ │
│ │ ○ Pickthall     2.8 MB  │ │
│ │ ○ Yusuf Ali     3.1 MB  │ │
│ │                         │ │
│ │     Storage: 8.9 MB     │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ AVAILABLE                   │
│ ┌─────────────────────────┐ │
│ │ English (11)          › │ │
│ │ Turkish (10)          › │ │
│ │ Urdu (8)              › │ │
│ │ Persian (11)          › │ │
│ │ Russian (8)           › │ │
│ │ Spanish (4)           › │ │
│ │ ...40+ more languages   │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Tafseer in Verse Actions Sheet

```
┌─────────────────────────────┐
│ ← Tafseer         [2:255]  │
├─────────────────────────────┤
│ ┌───────────┬──────────────┐│
│ │ Ibn Kathir│ Ma'arif      ││
│ └───────────┴──────────────┘│
│                             │
│ Allah - there is no deity   │
│ except Him, the Ever-Living,│
│ the Sustainer of all        │
│ existence...                │
│                             │
│ [Tafsir text loads here     │
│  from API, with loading     │
│  spinner on first load.     │
│  Cached in MMKV for 24hrs.] │
│                             │
│ Ibn Kathir writes:          │
│ "This is the greatest verse │
│ in the Quran as reported    │
│ in Sahih Muslim..."         │
│                             │
└─────────────────────────────┘
```

---

## 7. Footnote Parsing Strategy

### Sources and Their Formats

| Source | Format | Example |
|---|---|---|
| Al Quran Cloud | Plain text | `"In the name of Allah..."` |
| Quran Foundation | HTML with footnotes | `"the Ever-Living,<sup foot_note=196031>1</sup>"` |
| Bundled Saheeh | JSON with footnote map | `{t: "text...", f: {"1": "footnote text"}}` |
| Bundled Clear Quran | HTML text | `"text with [brackets]"` |

### Recommended Parsing Approach

For **Al Quran Cloud** translations (primary source): No parsing needed — plain text.

For **bundled Saheeh International** (existing): Already handled in `VerseItem.tsx` and `TranslationContent.tsx` — strips `<sup>` tags, renders footnotes separately.

For **Quran Foundation tafsir text** (HTML): Use a lightweight HTML-to-text stripper or render with `react-native-render-html` for rich formatting.

```typescript
// Simple footnote stripper for quran.com format
function stripFootnotes(html: string): { text: string; footnoteIds: string[] } {
  const footnoteIds: string[] = [];
  const text = html.replace(
    /<sup\s+foot_note=(\d+)>\d+<\/sup>/g,
    (_, id) => {
      footnoteIds.push(id);
      return '';
    }
  );
  return { text: text.trim(), footnoteIds };
}
```

For tafseer rendering (rich HTML), consider `@expo/html-elements` or a simple mapping of `<p>` → `Text`, `<h2>` → bold `Text`, etc.

---

## 8. Implementation Phases

### Phase 1: Dynamic Translation Selection (Bundled Only)

**Scope:** Make the existing hardcoded system configurable
**Effort:** Small
**Files:** ~5 files modified, 1 new settings screen

1. Add `selectedTranslation: 'saheeh' | 'clear-quran'` to `mushafSettingsStore`
2. Update `enhancedVerseData.ts` to read from selected source
3. Update `VerseItem.tsx` label to be dynamic
4. Update `TranslationContent.tsx` to highlight active translation
5. Add minimal "Translations" section in settings (toggle between 2 bundled options)

### Phase 2: Download & Manage Remote Translations

**Scope:** Al Quran Cloud API integration, SQLite storage, download management
**Effort:** Medium
**Files:** ~8-10 new files, ~5 modified

1. Create `services/translation/TranslationApiService.ts` (Al Quran Cloud client)
2. Create `services/translation/TranslationDbService.ts` (SQLite read/write)
3. Create `services/translation/TranslationDownloadService.ts` (fetch → SQLite pipeline)
4. Register in `AppInitializer.ts`
5. Create `store/translationStore.ts` (downloaded list, active selection, download progress)
6. Build full translation settings screen with language grouping, search, storage display
7. Update `enhancedVerseData.ts` to load from SQLite when selected translation isn't bundled
8. Add FTS5 search capability

### Phase 3: Tafseer Integration

**Scope:** Quran Foundation API for tafaseer, verse-level tafseer display
**Effort:** Medium
**Files:** ~5-6 new files, ~3 modified

1. Create `services/tafseer/TafseerApiService.ts` (Quran Foundation client with OAuth2)
2. Create `services/tafseer/TafseerCacheService.ts` (MMKV cache with 24hr TTL)
3. Create `components/sheets/verse-actions/TafseerContent.tsx`
4. Add `'tafseer'` to `ActiveScreen` type in `VerseActionsSheet.tsx`
5. Add "Tafseer" row to EXPLORE section in `VerseActionsSheet.tsx`
6. Add tafseer source selection in settings

---

## 9. Open Questions & Decisions Needed

### Must Decide Before Implementation

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | **Primary API source for translations?** | Al Quran Cloud (no auth, 101) vs Quran Foundation (OAuth2, 74) vs fawazahmed0 (440+, CDN) | **Al Quran Cloud** — no auth, sufficient coverage, plain text |
| 2 | **Tafseer API source?** | Quran Foundation (20, multi-lang) vs Al Quran Cloud (6, Arabic only) | **Quran Foundation** — more tafaseer, multi-language |
| 3 | **Pre-bundle translations?** | Saheeh only (3MB) vs Saheeh + 2 more (9MB) vs none (download all) | **Saheeh only** — already bundled, minimal size |
| 4 | **Max simultaneous translations?** | 1 (simple) vs 2-3 (power users) | **1 active + ability to view others in sheet** |
| 5 | **Supabase as intermediary?** | Direct API calls vs proxy through Supabase Edge Functions | **Direct API** — simpler, $0 cost, less maintenance |
| 6 | **Tafseer storage?** | API-only vs cache in MMKV vs download to SQLite | **API + MMKV cache** — tafaseer too large for SQLite |
| 7 | **Should we support FTS search?** | Yes (search within translations) vs No (simpler) | **Yes, Phase 2** — high user value, SQLite FTS5 is free |
| 8 | **Show translation during mushaf mode?** | Yes (below page) vs No (only in list/player view) | **No for mushaf, yes for reading/player** |

### Nice-to-Have (Future)

- Word-by-word translation (requires different data source)
- Audio translations (translation recited aloud)
- Transliteration toggle (already partially exists)
- Translation comparison mode (side-by-side 2-3 translations)
- Offline tafseer for select short tafaseer (Muyassar ~50MB)

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Al Quran Cloud API goes down | Low | High | Cache aggressively; fallback to bundled Saheeh |
| Quran Foundation changes OAuth2 flow | Low | Medium | Abstract auth into service; easy to update |
| Translation data quality issues | Medium | Low | Use established translations (Sahih, Pickthall); allow user reports |
| SQLite DB grows too large | Low | Medium | Cap at 150MB; auto-evict least-used translations |
| Slow download on poor networks | Medium | Medium | Background downloads; progress indicators; resume support |
| RTL layout issues with translation text | Medium | Medium | Test with Urdu/Persian/Hebrew translations early |

---

## Appendix A: API Endpoint Quick Reference

### Al Quran Cloud (Primary — Translations)

```
Base: https://api.alquran.cloud/v1

GET /edition?format=text&type=translation     → List all translations
GET /edition?format=text&type=tafsir          → List all tafaseer
GET /surah/{surah}/{edition}                  → Full surah translation
GET /ayah/{surah}:{ayah}/{edition}            → Single verse translation
GET /juz/{juz}/{edition}                      → Full juz translation
GET /page/{page}/{edition}                    → Full page translation
GET /surah/{surah}                            → Arabic text only
```

### Quran Foundation (Tafaseer + Footnotes)

```
Base: https://api.quran.com/api/v4

GET /resources/translations                   → List translations (74)
GET /resources/tafsirs                        → List tafaseer (20)
GET /resources/languages                      → List languages (87)
GET /verses/by_chapter/{ch}?translations={id} → Verses with translation
GET /verses/by_chapter/{ch}?tafsirs={id}      → Verses with tafsir
GET /verses/by_key/{key}?translations={id}    → Single verse + translation
GET /quran/translations/{id}                  → Full translation download

Auth: OAuth2 Client Credentials
Header: x-auth-token, x-client-id
Token TTL: 3600s (1 hour)
```

## Appendix B: Complete Translation List by Language (Al Quran Cloud)

<details>
<summary>English (11+ editions)</summary>

| Identifier | Name |
|---|---|
| en.sahih | Saheeh International |
| en.pickthall | Pickthall |
| en.yusufali | Yusuf Ali |
| en.arberry | Arberry |
| en.asad | Muhammad Asad |
| en.ahmedali | Ahmed Ali |
| en.daryabadi | Daryabadi |
| en.hilali | Hilali & Khan |
| en.qaribullah | Qaribullah & Darwish |
| en.sarwar | Sarwar |
| en.shakir | Shakir |
| en.itani | Talal Itani |
| en.maududi | Maududi |
| en.mubarakpuri | Mubarakpuri |
| en.wahiduddin | Wahiduddin Khan |

</details>

<details>
<summary>Turkish (10 editions)</summary>

| Identifier | Name |
|---|---|
| tr.ates | Suleyman Ates |
| tr.bulac | Ali Bulac |
| tr.diyanet | Diyanet |
| tr.golpinarli | Golpinarli |
| tr.ozturk | Yasar Nuri Ozturk |
| tr.vakfi | Diyanet Vakfi |
| tr.yazir | Elmalili Hamdi Yazir |
| tr.yildirim | Suat Yildirim |
| tr.yuksel | Edip Yuksel |

</details>

<details>
<summary>Urdu (8 editions)</summary>

| Identifier | Name |
|---|---|
| ur.ahmedali | Ahmed Ali |
| ur.jalandhry | Fateh Muhammad Jalandhry |
| ur.jawadi | Ayatollah Jawadi |
| ur.kanzuliman | Ahmed Raza Khan (Kanzuliman) |
| ur.qadri | Tahir ul Qadri |
| ur.junagarhi | Muhammad Junagarhi |
| ur.maududi | Maududi |
| ur.najafi | Najafi |

</details>

<details>
<summary>Persian/Farsi (11 editions)</summary>

Fooladvand, Makarem, Ghomshei, Ansarian, Ayati, Bahrampour, Khorramshahi, Mojtabavi, Khorramdel, Moezzi, Gharaati

</details>

<details>
<summary>Russian (8 editions)</summary>

Kuliev, Osmanov, Porokhova, Abu Adel, Krachkovsky, Muntahab, Sablukov, Kuliev-Alsaadi

</details>

<details>
<summary>Other Languages (40+)</summary>

Albanian (3), Azerbaijani (1), Bengali (1), Bosnian (1), Bulgarian (1), Chinese (1), Czech (1), Dutch (1), French (1), German (1), Hindi (1), Indonesian (1), Italian (1), Japanese (1), Korean (1), Malay (1), Malayalam (1), Norwegian (1), Polish (1), Portuguese (1), Romanian (1), Somali (1), Spanish (4), Swahili (1), Swedish (1), Tajik (1), Tamil (1), Thai (1), Uyghur (1), Uzbek (1), + more

</details>

## Appendix C: Complete Tafseer List (Quran Foundation)

| ID | Name | Language |
|---|---|---|
| 14 | Tafsir Ibn Kathir | Arabic |
| 15 | Tafsir al-Tabari | Arabic |
| 16 | Tafsir Muyassar | Arabic |
| 90 | Al-Qurtubi | Arabic |
| 91 | Al-Sa'di | Arabic |
| 93 | Al-Tafsir al-Wasit (Tantawi) | Arabic |
| 94 | Tafseer Al-Baghawi | Arabic |
| 164 | Tafseer Ibn Kathir | Bengali |
| 165 | Tafsir Ahsanul Bayaan | Bengali |
| 166 | Tafsir Abu Bakr Zakaria | Bengali |
| 381 | Tafsir Fathul Majid | Bengali |
| 159 | Bayan ul Quran (Israr Ahmad) | Urdu |
| 157 | Fi Zilal al-Quran (Qutb) | Urdu |
| 160 | Tafsir Ibn Kathir | Urdu |
| 818 | Tazkir ul Quran (Wahiduddin Khan) | Urdu |
| 169 | Ibn Kathir (Abridged) | English |
| 168 | Ma'arif al-Qur'an (Shafi) | English |
| 817 | Tazkirul Quran (Wahiduddin Khan) | English |
| 170 | Al-Sa'di | Russian |
| 804 | Rebar Kurdish Tafsir | Kurdish |
