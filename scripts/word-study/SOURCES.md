<!-- @ai-generated -->
# Sources of the word study data

The product owner chose the sources (docs/plans/2026-11-14-word-study/README.md,
decision 4): **classical or openly licensed only**.

| For | Source | Status |
|---|---|---|
| Gharib | Ibn al-Ha'im (d. 815 AH), *al-Tibyan fi Tafsir Gharib al-Qur'an*, from Quranpedia's `meanings` dump (book 327) | Chosen |
| Rasm | Tanzil Quran Text, Simple v1.1, without pause marks | Chosen |

`sources.lock.json` pins the exact files; the builds refuse any other.
`THIRD_PARTY_LICENSES.md` quotes both licences.

## Gharib: `meanings.json.gz`

| | |
|---|---|
| Download | https://quranpedia.net/dumps/meanings.json.gz (open, no login) |
| Retrieved | 2026-11-14 |
| Version | 2026-11-14 (`license.version` in the file; `version` of https://quranpedia.net/dumps/manifest.json) |
| Size | 748,521 bytes |
| SHA-256 | `b46ca5ae7baa5287dc08816d5c6037e8ad9282e49cf870357e6bb6184b8d0699`, equal to the `sha256` the manifest lists for `meanings.json.gz` |
| Content | Schema `/v1/ayah/{surah}/{ayah}/meanings`; four books, of which only book 327 is read: *al-Tibyan fi Tafsir Gharib al-Qur'an*, Ibn al-Ha'im (d. 815 AH), ed. Dahi Abd al-Baqi Muhammad, Dar al-Gharb al-Islami, 1st ed., 1423 AH. 2,746 entries over 1,955 verses |
| Licence | https://quranpedia.net/dumps/LICENSE.md, version 2026-11-13: free to use in apps; republishing as a database or dataset needs a credit to Quranpedia.net with a link and the dump version. Classical works are not owned; contemporary works stay with their owners, which is why only the classical book is used |
| Cleaning | The editor's bracketed insertions (`[زه]`, `[أو قرأت]`, verse numbers such as `[7]`) and footnote markers (`«7»`, a trailing `.27،`) are removed; spaces around punctuation are tidied. The gate refuses any digit, bracket, markup, Latin letter or U+FFFD left over |
| Result | 2,696 of 2,746 entries (98.2%) on words: tier 1 2,485, tier 2 42, tier 3 169. At verse level and not shown: tier 4 10, a neighbouring verse 1, no match 39 (mostly reading variants or explanations in the headword, such as «أَمَرْناوآمرنا») |

## Rasm: `quran-simple.txt`

| | |
|---|---|
| Download | https://tanzil.net/pub/download/index.php?quranType=simple&outType=txt-2&agree=true (the download page's "I agree with Terms of Use"; text with aya numbers, no pause marks, sajdah or rub-el-hizb signs; superscript alefs kept, no tatweel) |
| Retrieved | 2026-11-14 |
| Version | Tanzil Quran Text, Simple, 1.1 (released 2021-02-12, https://tanzil.net/updates/) |
| Size | 1,338,090 bytes |
| SHA-256 | `f3268cfe7a400add8a8024fe23368d66f58cc8baa51773fe94e323625c66344b`. The verse lines alone: `244fef960ae27eb289ade46144d913041dc0944461a156ae18e471c0fe3a58d1` (`textSha256`). Tanzil writes the current year into the copyright block of each download ("2007-2026"), so a download in a later year has another file hash; the build then says whether the verse text is still the locked one |
| Content | 6,236 verses and the copyright block. Verse 1 of every surah but 1 and 9 starts with the basmala, which the build drops |
| Licence | Creative Commons Attribution 3.0 with Tanzil's terms of use (in the file and at https://tanzil.net/docs/text_license): verbatim copies only, "CHANGING IT IS NOT ALLOWED"; the source (Tanzil Project) indicated with a link to tanzil.net; the notice kept in derived files. Open: the FAQ's "available for non-commercial purposes" line, and whether per-word excerpts count as a change (see `THIRD_PARTY_LICENSES.md`) |
| Result | All 77,429 app words paired (365 vocative joins, 20:94:2, 72:16:1, four two-word positions), the rule pairing equal to `groupVerse` in every verse. 6,913 words differ: 6,900 with a shown note; 50 notes in 45 words hidden until reviewed (`--report`) |

Research copies of both files, downloaded earlier on 2026-11-14 for the
source research, have the same SHA-256.

## Not used

| Candidate | Why not |
|---|---|
| The Tafsir Center for Quranic Studies' datasets (`quran.db` on Hugging Face) | The product owner ruled them out (the organisation behind the Surah app) |
| Quran.com / Quran Foundation API (`text_imlaei`, word fields) | Its developer terms forbid redistributing the content as a database or bundle without a signed licence. Its imla'i is Tanzil's text (1.0.x) |
| QUL downloads (imla'i script, gharib resources) | Login required, no licence stated ("We don't have copyright information for this resource"), and Tarteel's terms forbid scripted access |
| Contemporary gharib books: al-Khudayri's *al-Siraj* (491), Makhluf's *Kalimat al-Qur'an* (1424), KFGQPC's *al-Muyassar fi Gharib al-Qur'an* | Quranpedia's licence leaves contemporary works with their authors and publishers; no permission on record |
| Ibn al-Jawzi's *Tadhkirat al-Arib* (208), in the same dump | Classical, but about 2% of its records are keyed to the wrong verse and 5% are split wrongly (meaning text in the headword); not chosen for v1 |
| OpenITI texts | CC BY-NC-SA 4.0 (non-commercial) |
| MASAQ's `Word` column | Its text may derive from Tanzil; not needed once Tanzil is used directly |
