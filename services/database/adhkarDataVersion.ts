// services/database/adhkarDataVersion.ts
// Data version: increment when data/adhkar.json or the super category seed
// changes, to trigger a re-seed on existing installs. Kept free of imports so
// node scripts (scripts/adhkar-content) can read it.
// Version 1: Initial adhkar data (267 items)
// Version 2: Added Quranic Duas (40 items, total 307)
// Version 3: Fixed audio file naming (dua_X.mp3 -> adhkar_X.mp3)
// Version 4: Added 99 Names of Allah (99 items, total 406)
// Version 5: Balanced "Other" section bento grid (left=14, right=14)
// Version 6: Morning/evening split (6 evening rows, per-period dhikr lists,
//            super_categories.dhikr_ids), text, count and audio fixes
// Version 7: Test builds only, never released
// Version 8: Sourced transliterations and instructions, 99 Names meanings,
//            restored row 114, marker fixes, category 132 under Home,
//            evening audio overrides
// Version 9: Count notes outside the dhikr marks, transliteration marks,
//            rows 197, 204, 250 and 265 from sunnah.com, category 86 title
export const ADHKAR_DATA_VERSION = 9;
