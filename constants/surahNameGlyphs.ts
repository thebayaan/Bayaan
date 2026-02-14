/** Ornamental surah divider frame — PUA glyph U+E000 from quran-common.ttf */
export const SURAH_DIVIDER_CHAR = '\uE000';

/** Surah icon ligature in surah-name-v4.ttf — renders before the surah name */
export const SURAH_ICON_CHAR = 'surah-icon';

/** Get the ligature string for a surah name glyph in surah-name-v4.ttf */
export function getSurahNameChar(surahNumber: number): string {
  if (surahNumber < 1 || surahNumber > 114) return '';
  return `surah${String(surahNumber).padStart(3, '0')}`;
}

/**
 * QCF_FullSurah_HD_COLOR codepoint map — maps surah number (1-114) to the
 * direct Unicode codepoint in surah-name-qcf.ttf (King Fahad Complex font).
 * Each glyph includes the surah name WITH a decorative "سورة" icon.
 * Order follows the font's internal GID table (FC45-FC64 then FB51-FBEB).
 */
const QCF_SURAH_CODEPOINTS: readonly number[] = [
  // Surahs 1-21: FC45-FC64 range
  /* 1  */ 0xfc45, /* 2  */ 0xfc46, /* 3  */ 0xfc47, /* 4  */ 0xfc4a,
  /* 5  */ 0xfc4b, /* 6  */ 0xfc4e, /* 7  */ 0xfc4f, /* 8  */ 0xfc51,
  /* 9  */ 0xfc52, /* 10 */ 0xfc53, /* 11 */ 0xfc55, /* 12 */ 0xfc56,
  /* 13 */ 0xfc58, /* 14 */ 0xfc5a, /* 15 */ 0xfc5b, /* 16 */ 0xfc5c,
  /* 17 */ 0xfc5d, /* 18 */ 0xfc5e, /* 19 */ 0xfc61, /* 20 */ 0xfc62,
  /* 21 */ 0xfc64,
  // Surahs 22-114: FB51-FBEB range
  /* 22 */ 0xfb51, /* 23 */ 0xfb52, /* 24 */ 0xfb54, /* 25 */ 0xfb55,
  /* 26 */ 0xfb57, /* 27 */ 0xfb58, /* 28 */ 0xfb5a, /* 29 */ 0xfb5b,
  /* 30 */ 0xfb5d, /* 31 */ 0xfb5e, /* 32 */ 0xfb60, /* 33 */ 0xfb61,
  /* 34 */ 0xfb63, /* 35 */ 0xfb64, /* 36 */ 0xfb66, /* 37 */ 0xfb67,
  /* 38 */ 0xfb69, /* 39 */ 0xfb6a, /* 40 */ 0xfb6c, /* 41 */ 0xfb6d,
  /* 42 */ 0xfb6f, /* 43 */ 0xfb70, /* 44 */ 0xfb72, /* 45 */ 0xfb73,
  /* 46 */ 0xfb75, /* 47 */ 0xfb76, /* 48 */ 0xfb78, /* 49 */ 0xfb79,
  /* 50 */ 0xfb7b, /* 51 */ 0xfb7c, /* 52 */ 0xfb7e, /* 53 */ 0xfb7f,
  /* 54 */ 0xfb81, /* 55 */ 0xfb82, /* 56 */ 0xfb84, /* 57 */ 0xfb85,
  /* 58 */ 0xfb87, /* 59 */ 0xfb88, /* 60 */ 0xfb8a, /* 61 */ 0xfb8b,
  /* 62 */ 0xfb8d, /* 63 */ 0xfb8e, /* 64 */ 0xfb90, /* 65 */ 0xfb91,
  /* 66 */ 0xfb93, /* 67 */ 0xfb94, /* 68 */ 0xfb96, /* 69 */ 0xfb97,
  /* 70 */ 0xfb99, /* 71 */ 0xfb9a, /* 72 */ 0xfb9c, /* 73 */ 0xfb9d,
  /* 74 */ 0xfb9f, /* 75 */ 0xfba0, /* 76 */ 0xfba2, /* 77 */ 0xfba3,
  /* 78 */ 0xfba5, /* 79 */ 0xfba6, /* 80 */ 0xfba8, /* 81 */ 0xfba9,
  /* 82 */ 0xfbab, /* 83 */ 0xfbac, /* 84 */ 0xfbae, /* 85 */ 0xfbaf,
  /* 86 */ 0xfbb1, /* 87 */ 0xfbb2, /* 88 */ 0xfbb4, /* 89 */ 0xfbb5,
  /* 90 */ 0xfbb7, /* 91 */ 0xfbb8, /* 92 */ 0xfbba, /* 93 */ 0xfbbb,
  /* 94 */ 0xfbbd, /* 95 */ 0xfbbe, /* 96 */ 0xfbc0, /* 97 */ 0xfbc1,
  /* 98 */ 0xfbd3, /* 99 */ 0xfbd4, /* 100*/ 0xfbd6, /* 101*/ 0xfbd7,
  /* 102*/ 0xfbd9, /* 103*/ 0xfbda, /* 104*/ 0xfbdc, /* 105*/ 0xfbdd,
  /* 106*/ 0xfbdf, /* 107*/ 0xfbe0, /* 108*/ 0xfbe2, /* 109*/ 0xfbe3,
  /* 110*/ 0xfbe5, /* 111*/ 0xfbe6, /* 112*/ 0xfbe8, /* 113*/ 0xfbe9,
  /* 114*/ 0xfbeb,
];

export function getQCFSurahNameChar(surahNumber: number): string {
  const cp = QCF_SURAH_CODEPOINTS[surahNumber - 1];
  return cp ? String.fromCodePoint(cp) : '';
}
