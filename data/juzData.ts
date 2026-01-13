/**
 * Juz Data - Maps each of the 30 Juz (parts) of the Quran to their Surahs
 *
 * Each Juz contains specific Surahs. Some Surahs span multiple Juz.
 * This mapping assigns each Surah to its primary Juz (where it starts).
 */

export interface JuzInfo {
  id: number;
  name: string;
  arabicName: string;
  startSurah: number;
  endSurah: number;
  // Array of all surah IDs that have verses in this Juz
  surahs: number[];
}

/**
 * Complete mapping of all 30 Juz with their surah ranges
 * Based on the traditional division of the Quran
 */
export const JUZ_DATA: JuzInfo[] = [
  {id: 1, name: 'Alif Lam Meem', arabicName: 'الٓمٓ', startSurah: 1, endSurah: 2, surahs: [1, 2]},
  {id: 2, name: 'Sayaqool', arabicName: 'سَيَقُولُ', startSurah: 2, endSurah: 2, surahs: [2]},
  {id: 3, name: 'Tilkal Rusul', arabicName: 'تِلْكَ الرُّسُلُ', startSurah: 2, endSurah: 3, surahs: [2, 3]},
  {id: 4, name: 'Lan Tanaloo', arabicName: 'لَن تَنَالُوا', startSurah: 3, endSurah: 4, surahs: [3, 4]},
  {id: 5, name: 'Wal Mohsanat', arabicName: 'وَالْمُحْصَنَاتُ', startSurah: 4, endSurah: 4, surahs: [4]},
  {id: 6, name: 'La Yuhibbullah', arabicName: 'لَا يُحِبُّ اللَّهُ', startSurah: 4, endSurah: 5, surahs: [4, 5]},
  {id: 7, name: 'Wa Iza Samiu', arabicName: 'وَإِذَا سَمِعُوا', startSurah: 5, endSurah: 6, surahs: [5, 6]},
  {id: 8, name: 'Wa Lau Annana', arabicName: 'وَلَوْ أَنَّنَا', startSurah: 6, endSurah: 7, surahs: [6, 7]},
  {id: 9, name: 'Qalal Malao', arabicName: 'قَالَ الْمَلَأُ', startSurah: 7, endSurah: 8, surahs: [7, 8]},
  {id: 10, name: 'Wa Alamu', arabicName: 'وَاعْلَمُوا', startSurah: 8, endSurah: 9, surahs: [8, 9]},
  {id: 11, name: 'Yatazeroon', arabicName: 'يَعْتَذِرُونَ', startSurah: 9, endSurah: 11, surahs: [9, 10, 11]},
  {id: 12, name: 'Wa Mamin Daabbah', arabicName: 'وَمَا مِن دَابَّةٍ', startSurah: 11, endSurah: 12, surahs: [11, 12]},
  {id: 13, name: 'Wa Ma Ubrioo', arabicName: 'وَمَا أُبَرِّئُ', startSurah: 12, endSurah: 14, surahs: [12, 13, 14]},
  {id: 14, name: 'Rubama', arabicName: 'رُبَمَا', startSurah: 15, endSurah: 16, surahs: [15, 16]},
  {id: 15, name: 'Subhanallazi', arabicName: 'سُبْحَانَ الَّذِي', startSurah: 17, endSurah: 18, surahs: [17, 18]},
  {id: 16, name: 'Qal Alam', arabicName: 'قَالَ أَلَمْ', startSurah: 18, endSurah: 20, surahs: [18, 19, 20]},
  {id: 17, name: 'Iqtaraba', arabicName: 'اقْتَرَبَ', startSurah: 21, endSurah: 22, surahs: [21, 22]},
  {id: 18, name: 'Qad Aflaha', arabicName: 'قَدْ أَفْلَحَ', startSurah: 23, endSurah: 25, surahs: [23, 24, 25]},
  {id: 19, name: 'Wa Qalallazina', arabicName: 'وَقَالَ الَّذِينَ', startSurah: 25, endSurah: 27, surahs: [25, 26, 27]},
  {id: 20, name: 'Amman Khalaq', arabicName: 'أَمَّنْ خَلَقَ', startSurah: 27, endSurah: 29, surahs: [27, 28, 29]},
  {id: 21, name: 'Otlu Ma Oohi', arabicName: 'اتْلُ مَا أُوحِيَ', startSurah: 29, endSurah: 33, surahs: [29, 30, 31, 32, 33]},
  {id: 22, name: 'Wa Manyaqnut', arabicName: 'وَمَن يَقْنُتْ', startSurah: 33, endSurah: 36, surahs: [33, 34, 35, 36]},
  {id: 23, name: 'Wa Mali', arabicName: 'وَمَا لِيَ', startSurah: 36, endSurah: 39, surahs: [36, 37, 38, 39]},
  {id: 24, name: 'Faman Azlam', arabicName: 'فَمَنْ أَظْلَمُ', startSurah: 39, endSurah: 41, surahs: [39, 40, 41]},
  {id: 25, name: 'Ilayhi Yurad', arabicName: 'إِلَيْهِ يُرَدُّ', startSurah: 41, endSurah: 45, surahs: [41, 42, 43, 44, 45]},
  {id: 26, name: 'Ha Meem', arabicName: 'حم', startSurah: 46, endSurah: 51, surahs: [46, 47, 48, 49, 50, 51]},
  {id: 27, name: 'Qala Fama Khatbukum', arabicName: 'قَالَ فَمَا خَطْبُكُمْ', startSurah: 51, endSurah: 57, surahs: [51, 52, 53, 54, 55, 56, 57]},
  {id: 28, name: 'Qad Sami Allah', arabicName: 'قَدْ سَمِعَ اللَّهُ', startSurah: 58, endSurah: 66, surahs: [58, 59, 60, 61, 62, 63, 64, 65, 66]},
  {id: 29, name: 'Tabarakallazi', arabicName: 'تَبَارَكَ الَّذِي', startSurah: 67, endSurah: 77, surahs: [67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77]},
  {id: 30, name: 'Amma', arabicName: 'عَمَّ', startSurah: 78, endSurah: 114, surahs: [78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114]},
];

/**
 * Map of surah ID to its primary Juz number
 * A surah is assigned to the Juz where most of its verses appear
 */
export const SURAH_TO_JUZ: Record<number, number> = {
  1: 1, 2: 1, 3: 3, 4: 4, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10,
  10: 11, 11: 11, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14,
  17: 15, 18: 15, 19: 16, 20: 16, 21: 17, 22: 17, 23: 18,
  24: 18, 25: 18, 26: 19, 27: 19, 28: 20, 29: 20, 30: 21,
  31: 21, 32: 21, 33: 21, 34: 22, 35: 22, 36: 22, 37: 23,
  38: 23, 39: 23, 40: 24, 41: 24, 42: 25, 43: 25, 44: 25,
  45: 25, 46: 26, 47: 26, 48: 26, 49: 26, 50: 26, 51: 26,
  52: 27, 53: 27, 54: 27, 55: 27, 56: 27, 57: 27, 58: 28,
  59: 28, 60: 28, 61: 28, 62: 28, 63: 28, 64: 28, 65: 28,
  66: 28, 67: 29, 68: 29, 69: 29, 70: 29, 71: 29, 72: 29,
  73: 29, 74: 29, 75: 29, 76: 29, 77: 29, 78: 30, 79: 30,
  80: 30, 81: 30, 82: 30, 83: 30, 84: 30, 85: 30, 86: 30,
  87: 30, 88: 30, 89: 30, 90: 30, 91: 30, 92: 30, 93: 30,
  94: 30, 95: 30, 96: 30, 97: 30, 98: 30, 99: 30, 100: 30,
  101: 30, 102: 30, 103: 30, 104: 30, 105: 30, 106: 30,
  107: 30, 108: 30, 109: 30, 110: 30, 111: 30, 112: 30,
  113: 30, 114: 30,
};

/**
 * Get the Juz number for a given surah
 * @param surahId The surah ID (1-114)
 * @returns The Juz number (1-30)
 */
export const getJuzForSurah = (surahId: number): number => {
  return SURAH_TO_JUZ[surahId] || 1;
};

/**
 * Get Juz info by Juz number
 * @param juzNumber The Juz number (1-30)
 * @returns JuzInfo object or undefined
 */
export const getJuzInfo = (juzNumber: number): JuzInfo | undefined => {
  return JUZ_DATA.find(juz => juz.id === juzNumber);
};

/**
 * Get all surahs in a specific Juz
 * @param juzNumber The Juz number (1-30)
 * @returns Array of surah IDs in that Juz
 */
export const getSurahsInJuz = (juzNumber: number): number[] => {
  const juz = JUZ_DATA.find(j => j.id === juzNumber);
  return juz?.surahs || [];
};

/**
 * Interface for grouped surahs by Juz (for SectionList)
 */
export interface JuzSection<T> {
  juzNumber: number;
  juzName: string;
  juzArabicName: string;
  data: T[];
}

/**
 * Group surahs by their Juz number
 * Handles cases where not all surahs are present
 * @param surahs Array of surahs to group
 * @returns Array of JuzSection objects for use with SectionList
 */
export const groupSurahsByJuz = <T extends {id: number}>(
  surahs: T[],
): JuzSection<T>[] => {
  // Create a map to group surahs by Juz
  const juzMap = new Map<number, T[]>();

  // Group surahs by their Juz
  surahs.forEach(surah => {
    const juzNumber = getJuzForSurah(surah.id);
    if (!juzMap.has(juzNumber)) {
      juzMap.set(juzNumber, []);
    }
    juzMap.get(juzNumber)!.push(surah);
  });

  // Convert map to array of sections, sorted by Juz number
  const sections: JuzSection<T>[] = [];

  // Sort the Juz numbers to ensure proper order
  const sortedJuzNumbers = Array.from(juzMap.keys()).sort((a, b) => a - b);

  sortedJuzNumbers.forEach(juzNumber => {
    const juzInfo = getJuzInfo(juzNumber);
    if (juzInfo) {
      const surahsInJuz = juzMap.get(juzNumber) || [];
      // Sort surahs within each Juz by their ID
      surahsInJuz.sort((a, b) => a.id - b.id);

      sections.push({
        juzNumber,
        juzName: juzInfo.name,
        juzArabicName: juzInfo.arabicName,
        data: surahsInJuz,
      });
    }
  });

  return sections;
};

/**
 * Group surahs by Juz in descending order (for desc sort)
 * @param surahs Array of surahs to group
 * @returns Array of JuzSection objects sorted by Juz descending
 */
export const groupSurahsByJuzDesc = <T extends {id: number}>(
  surahs: T[],
): JuzSection<T>[] => {
  const sections = groupSurahsByJuz(surahs);
  // Reverse Juz order and reverse surahs within each Juz
  return sections.reverse().map(section => ({
    ...section,
    data: [...section.data].reverse(),
  }));
};
