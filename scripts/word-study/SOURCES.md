<!-- @ai-generated -->
# Sources of the word study data

The product owner chose the sources (docs/plans/2026-11-14-word-study/README.md,
decision 4): **classical or openly licensed only**.

| For | Source | Status |
|---|---|---|
| Gharib | Ibn al-Ha'im (d. 815 AH), *al-Tibyan fi Tafsir Gharib al-Qur'an*, from Quranpedia's `meanings` dump (book 327) | Chosen |
| Rasm | Tanzil Quran Text, Simple v1.1, without pause marks | Chosen |

`sources.lock.json` pins the exact files. The pinned downloads, their
checksums and the licence texts are recorded below once a DB is built from
them.

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
