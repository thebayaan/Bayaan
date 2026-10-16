# Evening adhkar texts for review (Hisn al-Muslim 77, 78, 80, 81, 89, 90)

Status: **approved by Osman** (2026-10-12): all six texts approved as written.

## Why this document exists

The app's Morning and Evening lists both show Hisn al-Muslim chapter 27 exactly as hisnmuslim.com stores it: the morning wording is the main text, and the evening wording sits in a bracketed note (`[وإذا أمسى قال: ...]`), sometimes cut short with `...`. Six of the 24 rows need their own evening row. The fix (plan: `docs/superpowers/plans/2026-10-12-adhkar-content-fix.md`) adds six new rows with new stable ids `evening-77`, `evening-78`, `evening-80`, `evening-81`, `evening-89`, `evening-90`, and strips the bracketed evening notes from the six morning rows.

## This document is the single source for the six texts

The `json evening-row` code blocks below are machine-read. `scripts/adhkar-content/apply-content-fixes.ts` parses every block that starts with ` ```json evening-row ` and writes the rows into `data/adhkar.json`. The jest suite fails if `data/adhkar.json` and these blocks disagree.

To change a text after review:

1. Edit the `json evening-row` block (and the prose above it, so the citation stays true).
2. Run `npx tsx scripts/adhkar-content/apply-content-fixes.ts`.
3. Run `npx tsx scripts/adhkar-content/write-data-fingerprint.ts`.
4. Run `npx jest services/adhkar scripts/__tests__ services/database`.

Block fields:

- `id`: the new row id. Must be `evening-<morning_id>`. Never rename it after release (favorites and counts point at it).
- `morning_id`: the morning row it pairs with.
- `arabic`: the evening text **without** the `(( ))` wrapper. The script adds `((` and `))` to match the convention of every other Hisn row (the widgets and the reader rely on it). The wrapper is the app's marker, not part of the text.
- `translation`: English, verbatim from the cited source.
- `transliteration`: verbatim from the cited source, or `null` when no source gives a full evening transliteration (the transliteration overhaul is a separate, later PR).
- `repeat_count`: integer.

The script also sets `category_id` `27`, the category name, `audio_url` `null` and `order_index` 24 to 29 in the order of the blocks. Its audio step sets `audio_file` to `adhkar_evening_77.mp3` and so on: evening audio is Mishary Alafasy (his 1434H evening session), added on 2026-10-13 per the user.

## Source policy (from the user)

No Arabic or English in this document is written by us. Order of preference:

1. The English Hisn al-Muslim edition: the islamhouse.com PDF and the hisnmuslim.com English pages / API.
2. sunnah.com, the hadith's own Arabic and English.
3. Other reputable sites (dorar.net for Arabic).

When a source gives only a "say X instead of Y" note, the text is marked **ASSEMBLED** and each part is cited.

Sources used throughout:

- **hisnmuslim API (Arabic):** http://www.hisnmuslim.com/api/ar/27.json. This is the app's source; its bracket notes carry no tashkeel.
- **hisnmuslim API (English):** http://www.hisnmuslim.com/api/en/27.json. This is the Ismail Ibrahim translation, which the app's morning rows already use. Fields: `TRANSLATED_TEXT` (English) and `LANGUAGE_ARABIC_TRANSLATED_TEXT` (transliteration). The page https://www.hisnmuslim.com/i/en/27 loads the same data.
- **Osoul PDF:** islamhouse.com English "Fortress of the Muslim", PDF https://d1.islamhouse.com/data/en/ih_books/single/en-fortress-of-the-muslim.pdf, from https://islamhouse.com/en/books/39062/. Imprint: Osoul Foundation For Dawah Content, 2025, ISBN 978-603-8537-06-0.
  - It is a different translation from the hisnmuslim / Ismail Ibrahim English, but it is the only Hisn edition that prints a full evening English text for all six rows.
  - Its Arabic does not survive text extraction, so it is not used for Arabic.
- **sunnah.com:** hadith pages, plus its own Hisn al-Muslim collection (`sunnah.com/hisn/<n>` shows Hisn item n-1). sunnah.com blocks plain curl (403); the pages were read through a web fetch tool on 2026-10-12.

## Decisions for the reviewer

1. **English source mix.** For 78 and 89, the hisnmuslim English (the same translation as the morning rows) has a full evening text, so it is used. For 77, 80, 81 and 90, hisnmuslim gives only a note, so the Osoul PDF is used. The evening list therefore mixes two translations, and the Osoul text uses "Allāh" with a macron. The alternative is Osoul for all six (its 78 and 89 texts are quoted under each row).
2. **Assembled Arabic.** No source gives a fully vocalized evening text matching the Hisn wording for 78, 80, 81 and 90. Each is assembled from the app's morning text, which already has tashkeel, and the substitution the Hisn note prescribes.
3. **Grading** (not a text change, for awareness). sunnah.com shows Abu Dawud 5069, 5073 and 5084 (behind 80, 81 and 89) as "Da'if (Al-Albani)". The Hisn author's footnotes and the Osoul PDF cite Ibn Baz and the Arna'uts grading them hasan. Hisn al-Muslim includes all three, so the app does too.

---

## 77: أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ ... هَذَا الْيَوْمِ

**Morning row (current main text, kept):**

> أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيرَ مَا بَعْدَهُ ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي  هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ

**Hisn note** (hisnmuslim api/ar/27, verbatim; removed from the morning row): `[ وإذا أمسى قال: أمسينا وأمسى الملك للَّه] [وإذا أمسى قال: رب أسألك خير ما في هذه الليلة، وخير ما بعدها، وأعوذ بك من شر ما في هذه الليلة، وشر ما بعدها.]`

**Evening Arabic**
- Verbatim from **Sahih Muslim 2723b**, https://sunnah.com/muslim:2723b. Only the dhikr itself is taken: the narrator's aside "قَالَ أُرَاهُ قَالَ فِيهِنَّ" and the quote marks are left out.
- It matches the Hisn wording word for word.
- Note: sunnah.com spells شَىْءٍ with alef maqsura, where the morning row has شَيْءٍ.
- Muslim **2723a**, cited in the audit, is a different wording ("اللَّهُمَّ أَسْأَلُكَ خَيْرَ هَذِهِ اللَّيْلَةِ ..."), so it is not used.

**Evening English:** Osoul PDF, p.73, verbatim.

**Different sources:** yes. The Arabic is from sunnah.com, the English from the Osoul PDF.

Other published English, for comparison:
- hisnmuslim api/en/27 has no full evening English. Its transliteration field ends "…likewise, one says in the morning:Amsayna wa-amsal-mulku lillah….‘We have reached the evening and at this very time unto Allah belongs all sovereignty…’". The source itself says "morning" where it means evening, and it mixes "this night" into the morning transliteration. That field is the app's current row-77 `instruction`, which the plan clears.
- The Muslim 2723b English on sunnah.com is a looser rendering and contains source typos ("tne Sovercignty").

**Transliteration:** `null`. No source gives a clean, full evening transliteration.

**Repeat count:** 1 (hisnmuslim api/ar/27, `REPEAT: 1`).

```json evening-row
{
  "id": "evening-77",
  "morning_id": "77",
  "arabic": "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَىْءٍ قَدِيرٌ رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ",
  "translation": "We have entered the evening, and all dominion belongs to Allāh, and all praise is due to Allāh. There is no deity worthy of worship except Allāh alone, without partner. His is the dominion and to Him belongs all praise, and He is over all things fully capable. My Lord, I ask You for the good of this night and the good that follows it, and I seek refuge in You from the evil of this night and the evil that follows it. My Lord, I seek refuge in You from laziness and the hardship of old age. My Lord, I seek refuge in You from the punishment of the Fire and the punishment of the grave.",
  "transliteration": null,
  "repeat_count": 1
}
```

---

## 78: اللَّهُمَّ بِكَ أَصْبَحْنَا ... وَإِلَيْكَ النُّشُورُ

**Morning row (kept):**

> اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا ، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ

**Hisn note** (hisnmuslim api/ar/27, verbatim; removed from the morning row): `[وإذا أمسى قال: اللَّهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك المصير.]`. sunnah.com/hisn/79 has the same note.

**Evening Arabic: ASSEMBLED.**
- Base: the morning text above (hisnmuslim api/ar/27, with tashkeel).
- Changes, per the Hisn note in the same source: أَصْبَحْنَا and أَمْسَيْنَا swap places, and النُّشُورُ becomes الْمَصِيرُ.
- The vocalization of وَإِلَيْكَ الْمَصِيرُ is taken from **Jami' at-Tirmidhi 3391**, https://sunnah.com/tirmidhi:3391.
- The stray space before the second comma in the morning text is not carried over.

**Evening English:** hisnmuslim api/en/27 `TRANSLATED_TEXT`, verbatim: the part after "[In the evening:]". This part is removed from the morning row's translation.

**Evening transliteration:** hisnmuslim api/en/27 `LANGUAGE_ARABIC_TRANSLATED_TEXT`, the part after "[In the evening:]", verbatim without its outer parentheses. This part is removed from the morning row's `instruction`.

**Different sources:** the Arabic is assembled from hisnmuslim plus Tirmidhi 3391. The English and the transliteration are from hisnmuslim.

**Repeat count:** 1 (hisnmuslim).

**Disagreement for the reviewer:** the narrations differ on the ending.
- **Hisn** (hisnmuslim, the author's own Arabic DOCX at https://d1.islamhouse.com/data/ar/ih_books/single_01/ar_Hisn_Almuslim.docx, the Osoul PDF, sunnah.com/hisn): morning النُّشُورُ, evening الْمَصِيرُ.
- **Tirmidhi 3391** (sunnah.com, graded Sahih by Darussalam) reverses them.
  - Its evening text: "اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ".
  - Its English: "O Allah, by You we enter the evening, and by You we enter the morning, and by You we live, and by You we die, and to You is the Resurrection".
- **Abu Dawud 5068** (https://sunnah.com/abudawud:5068) ends both with النُّشُورُ and has no وَبِكَ أَصْبَحْنَا in the evening.
- The block follows Hisn. The original Duraihim audio for row 78 also recites the Hisn evening form after "وإذا أمسى قال".

Alternative English (Osoul PDF, p.74): "O Allāh, by You we enter the evening and by You we enter the morning, by You we live and by You we die, and to You is the Final Return."

```json evening-row
{
  "id": "evening-78",
  "morning_id": "78",
  "arabic": "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ",
  "translation": "(O Allah, by Your leave we have reached the evening and by Your leave we have reached the morning, by Your leave we live and die and unto You is our return.)",
  "transliteration": "Allahumma bika amsayna, wabika asbahna, wabika nahya wabika namootu wa-ilaykal-maseer.",
  "repeat_count": 1
}
```

---

## 80: اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ ... (أربع مرات)

**Morning row (kept):**

> اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتِكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ

**Hisn notes** (removed from the morning row):
- Arabic (api/ar/27): `[ وإذا أمسى قال: اللَّهم إني أمسيت...]`
- English (api/en/27): "(Note: for the evening, one reads (amsaytu) instead of (asbahtu).)"

**Evening Arabic: ASSEMBLED.** The morning text above (hisnmuslim api/ar/27) with أَصْبَحْتُ replaced by أَمْسَيْتُ, as the Hisn note in the same source directs. أَمْسَيْتُ is spelled as the note spells it, with the vowels of the morning verb.

**Evening English:** Osoul PDF, p.76, verbatim. The PDF's spaced hyphens are kept as printed.

**Different sources:** yes. The Arabic is assembled from hisnmuslim, the English is from the Osoul PDF.

**Transliteration:** `null`. hisnmuslim gives only the substitution note.

**Repeat count:** 4.
- hisnmuslim: `REPEAT: 4`, and the English says "(four times in the morning & evening)".
- Osoul: "In the evening, recite the following 4 times in Arabic".

**For the reviewer:**
- **Abu Dawud 5069** (https://sunnah.com/abudawud:5069) reads وَمَلاَئِكَتَكَ (fatha), where Hisn and the morning row have وَمَلاَئِكَتِكَ (kasra). It keeps أَصْبَحْتُ even for the evening and omits "وَحْدَكَ لاَ شَرِيكَ لَكَ".
- The block keeps the Hisn spelling so that the morning and evening rows match. Fixing the case ending in both rows is a separate decision.

```json evening-row
{
  "id": "evening-80",
  "morning_id": "80",
  "arabic": "اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتِكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ",
  "translation": "O Allāh, I have entered the evening calling You to witness - and calling the bearers of Your Throne, Your angels, and all of Your creation - that You alone are Allāh, there is no deity worthy of worship except You, You are alone without partner, and Muḥammad is Your servant and messenger.",
  "transliteration": null,
  "repeat_count": 4
}
```

---

## 81: اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ

**Morning row (kept):**

> اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ

**Hisn notes** (removed from the morning row):
- Arabic (api/ar/27): `[وإذا أمسى قال: اللَّهم ما أمسى بي...]`
- English (api/en/27): "(Note: for the evening, one reads (amsa) instead of (asbaha).)"

**Evening Arabic: ASSEMBLED.** The morning text above (hisnmuslim api/ar/27) with أَصْبَحَ replaced by أَمْسَى, as the Hisn note directs. The vocalization أَمْسَى is the one Muslim 2723b uses (وَأَمْسَى, https://sunnah.com/muslim:2723b).

**Evening English:** Osoul PDF, p.77, verbatim.

**Different sources:** yes. The Arabic is assembled from hisnmuslim plus Muslim 2723b, the English is from the Osoul PDF.

**Transliteration:** `null`.

**Repeat count:** 1 (hisnmuslim).

**For the reviewer:**
- **Abu Dawud 5073** (https://sunnah.com/abudawud:5073) omits "أَوْ بِأَحَدٍ مِنْ خَلْقِكَ". For the evening it says only "وَمَنْ قَالَ مِثْلَ ذَلِكَ حِينَ يُمْسِي".
- The morning row's translation keeps its virtue note ("whoever says this in the morning ... whoever says this in the evening ..."), because that note covers both periods.

```json evening-row
{
  "id": "evening-81",
  "morning_id": "81",
  "arabic": "اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ",
  "translation": "O Allāh, whatever blessing has come to me or to any of Your creation this evening is from You alone - You have no partner. So to You belongs all praise and all thanks.",
  "transliteration": null,
  "repeat_count": 1
}
```

---

## 89: أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ ... فَتْحَهُ

**Morning row (kept):**

> أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ، اللَّهُـمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذَا الْيَوْمِ:فَتْحَهُ، وَنَصْرَهُ، وَنورَهُ، وَبَرَكَتَهُ، وَهُدَاهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهِ وَشَرِّ مَا بَعْدَهُ

**Hisn note** (hisnmuslim api/ar/27, verbatim; removed from the morning row): `[وإذا أمسى قال: أمسينا وأمسى الملك للَّه ربّ العالمين اللَّهم إني أسألك خير هذه الليلة: فتحها، ونصرها، ونورها، وبركتها، وهداها، وأعوذ بك من شر ما فيها، وشر ما بعدها.]`

**Evening Arabic:** from **sunnah.com/hisn/90** (Hisn al-Muslim 89 on sunnah.com, https://sunnah.com/hisn/90), with three mechanical changes that do not alter any word or vowel:
1. The lead-in "وإذا أمسى قال: " is dropped.
2. The tatweel characters (ـ) are removed.
3. A stray kasra on the final alif of "فـيهـاِ" is removed (it becomes فيها).

The source text as printed:

> وإذا أمسى قال: أَمْسَيْـنا وَأَمْسـى المُـلكُ للهِ رَبِّ العـالَمـين ، اللّهُـمَّ إِنِّـي أسْـأَلُـكَ خَـيْرَ هـذهِ اللَّـيْلَة ، فَتْحَهـا ، وَنَصْـرَهـا ، وَنـورَهـا وَبَـرَكَتَـهـا ، وَهُـداهـا ، وَأَعـوذُ بِـكَ مِـنْ شَـرِّ ما فـيهـاِ وَشَـرِّ ما بَعْـدَهـا

**Evening English:** hisnmuslim api/en/27 `TRANSLATED_TEXT`, verbatim: the part after "[For the evening, the supplication is read as follows:]". This part is removed from the morning row's translation.

**Evening transliteration:** hisnmuslim api/en/27 `LANGUAGE_ARABIC_TRANSLATED_TEXT`, the evening part, verbatim without its outer parentheses. This part is removed from the morning row's `instruction`.

**Different sources:** the Arabic is from sunnah.com/hisn. The English and the transliteration are from hisnmuslim; both are Hisn editions.

**Repeat count:** 1 (hisnmuslim).

**For the reviewer:**
- **Abu Dawud 5084** (https://sunnah.com/abudawud:5084) says only "ثُمَّ إِذَا أَمْسَى فَلْيَقُلْ مِثْلَ ذَلِكَ".
- The sunnah.com/hisn spelling (للهِ, العالَمين, هذهِ) is lighter than the morning row's (لِلَّهِ, الْعَالَمِينَ). It is kept verbatim.

Alternative English (Osoul PDF, p.83): "We have entered a new evening, and with it all Sovereignty belongs to Allah, Lord of all that exists. O Allāh, I ask You for the goodness of this night, its victory, its help, its light, its blessings, and its guidance. I seek refuge in You from the evil that is in it and from the evil that follows it."

```json evening-row
{
  "id": "evening-89",
  "morning_id": "89",
  "arabic": "أَمْسَيْنا وَأَمْسى المُلكُ للهِ رَبِّ العالَمين ، اللّهُمَّ إِنِّي أسْأَلُكَ خَيْرَ هذهِ اللَّيْلَة ، فَتْحَها ، وَنَصْرَها ، وَنورَها وَبَرَكَتَها ، وَهُداها ، وَأَعوذُ بِكَ مِنْ شَرِّ ما فيها وَشَرِّ ما بَعْدَها",
  "translation": "(We have reached the evening and at this very time all sovereignty belongs to Allah, Lord of the worlds. O Allah, I ask You for the good of tonight, its triumphs and its victories, its light and its blessings and its guidance, and I take refuge in You from the evil of tonight and the evil that follows it.)",
  "transliteration": "Amsayna wa-amsal-mulku lillahi rabbil-AAalameen, allahumma innee as-aluka khayra hathihil-laylah, fat-haha, wanasraha, wanooraha, wabarakataha, wahudaha, wa-aAAoothu bika min sharri ma feeha washarri ma baAAdaha.",
  "repeat_count": 1
}
```

---

## 90: أَصْبَحْنا عَلَى فِطْرَةِ الْإِسْلاَمِ

**Morning row (kept):**

> أَصْبَحْنا عَلَى فِطْرَةِ الْإِسْلاَمِ، وَعَلَى كَلِمَةِ الْإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صلى الله عليه وسلم، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ الْمُشرِكِينَ

**Hisn notes** (removed from the morning row):
- Arabic (api/ar/27): `[وإذا أمسى قال: أمسينا على فطرة الإسلام...]`
- English (api/en/27): "(Note: for the evening, one reads amsayna instead of asbahna.)"

**Evening Arabic: ASSEMBLED.**
- Base: the morning text above (hisnmuslim api/ar/27), with أَصْبَحْنا replaced by أَمْسَيْنَا, as the Hisn note directs.
- The vocalization أَمْسَيْنَا is the one sunnah.com/hisn/91 prints (https://sunnah.com/hisn/91: "أَصْـبَحْنا[أَمْسَـينا] علـى فِطْـرَةِ الإسْلام، ...").
- The morning row's "صلى الله عليه وسلم" is kept as it is. sunnah.com/hisn/91 omits it.

**Evening English:** Osoul PDF, p.85, verbatim, with one exception.
- The PDF prints a ﷺ glyph after "Muḥammad" that does not survive text extraction (it comes out as "()"). It is written here as "(ﷺ)".
- Please confirm against the PDF page.

**Different sources:** yes. The Arabic is assembled from hisnmuslim plus sunnah.com/hisn, the English is from the Osoul PDF.

**Transliteration:** `null`.

**Repeat count:** 1 (hisnmuslim).

**Hadith sources** (not on sunnah.com):
- **Musnad Ahmad 15363:** https://islamtics.com/ar/hadith/musnad-ahmad/15363/ and https://hadithprophet.com/hadith-19411.html. It reads "كَانَ يَقُولُ إِذَا أَصْبَحَ، وَإِذَا أَمْسَى: أَصْبَحْنَا عَلَى فِطْرَةِ الْإِسْلَامِ ...". The Arna'ut footnote quoted there says only Waki' narrated "وإذا أمسى".
- **An-Nasa'i's wording** ends "وَمَا أَنَا مِنَ الْمُشْرِكِينَ" (quoted at https://surahquran.com/Dhikr-Dua-meaning-291.html).
- The block follows Hisn.

```json evening-row
{
  "id": "evening-90",
  "morning_id": "90",
  "arabic": "أَمْسَيْنَا عَلَى فِطْرَةِ الْإِسْلاَمِ، وَعَلَى كَلِمَةِ الْإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صلى الله عليه وسلم، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ الْمُشرِكِينَ",
  "translation": "We have ended this day upon the natural religion of Islam, the word of sincere devotion, the religion of our Prophet Muḥammad (ﷺ), and the faith of our father Ibrāhīm. He was upright (in worshipping Allāh), and a Muslim. He was not of those who worshipped others besides Allāh.",
  "transliteration": null,
  "repeat_count": 1
}
```

---

## Resulting lists (for context; set in `data/adhkar.json` by the same script)

Both lists are in Hisn order:

- **Morning (23):** 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 98
- **Evening (21):** 75, 76, evening-77, evening-78, 79, evening-80, evening-81, 82, 83, 84, 85, 86, 87, 88, evening-89, evening-90, 91, 92, 96, 97, 98

Why some rows appear in only one list:
- 93, 94 and 95 are morning only. Hisn says "إذا أصبح"; 94 and 95 are said after Fajr (Muslim 2726, Ibn Majah 925).
- 97 is evening only (Tirmidhi 3604b, "three times in the evening").
