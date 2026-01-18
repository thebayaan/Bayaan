/**
 * Juz (Part) Data for the Quran
 *
 * The Quran is divided into 30 Juz (parts) for easier reading.
 * This file maps each surah to the Juz where it STARTS.
 *
 * Note: Some surahs span multiple Juz, but we only track where they begin.
 */

/**
 * Mapping of surah ID (1-114) to its starting Juz number (1-30)
 */
export const SURAH_TO_JUZ: Record<number, number> = {
  // Juz 1: Surahs 1-2
  1: 1, // Al-Fatiha
  2: 1, // Al-Baqara

  // Juz 3: Surah 3
  3: 3, // Al-Imran

  // Juz 4: Surah 4
  4: 4, // An-Nisa

  // Juz 6: Surah 5
  5: 6, // Al-Ma'ida

  // Juz 7: Surah 6
  6: 7, // Al-An'am

  // Juz 8: Surah 7
  7: 8, // Al-A'raf

  // Juz 9: Surah 8
  8: 9, // Al-Anfal

  // Juz 10: Surah 9
  9: 10, // At-Tawba

  // Juz 11: Surahs 10-11
  10: 11, // Yunus
  11: 11, // Hud

  // Juz 12: Surah 12
  12: 12, // Yusuf

  // Juz 13: Surahs 13-14
  13: 13, // Ar-Ra'd
  14: 13, // Ibrahim

  // Juz 14: Surahs 15-16
  15: 14, // Al-Hijr
  16: 14, // An-Nahl

  // Juz 15: Surahs 17-18
  17: 15, // Al-Isra
  18: 15, // Al-Kahf

  // Juz 16: Surahs 19-20
  19: 16, // Maryam
  20: 16, // Ta-Ha

  // Juz 17: Surahs 21-22
  21: 17, // Al-Anbiya
  22: 17, // Al-Hajj

  // Juz 18: Surahs 23-25
  23: 18, // Al-Mu'minun
  24: 18, // An-Nur
  25: 18, // Al-Furqan

  // Juz 19: Surahs 26-27
  26: 19, // Ash-Shu'ara
  27: 19, // An-Naml

  // Juz 20: Surahs 28-29
  28: 20, // Al-Qasas
  29: 20, // Al-Ankabut

  // Juz 21: Surahs 30-33
  30: 21, // Ar-Rum
  31: 21, // Luqman
  32: 21, // As-Sajda
  33: 21, // Al-Ahzab

  // Juz 22: Surahs 34-36
  34: 22, // Saba
  35: 22, // Fatir
  36: 22, // Ya-Sin

  // Juz 23: Surahs 37-39
  37: 23, // As-Saffat
  38: 23, // Sad
  39: 23, // Az-Zumar

  // Juz 24: Surahs 40-41
  40: 24, // Ghafir
  41: 24, // Fussilat

  // Juz 25: Surahs 42-45
  42: 25, // Ash-Shura
  43: 25, // Az-Zukhruf
  44: 25, // Ad-Dukhan
  45: 25, // Al-Jathiya

  // Juz 26: Surahs 46-51
  46: 26, // Al-Ahqaf
  47: 26, // Muhammad
  48: 26, // Al-Fath
  49: 26, // Al-Hujurat
  50: 26, // Qaf
  51: 26, // Adh-Dhariyat

  // Juz 27: Surahs 52-57
  52: 27, // At-Tur
  53: 27, // An-Najm
  54: 27, // Al-Qamar
  55: 27, // Ar-Rahman
  56: 27, // Al-Waqi'a
  57: 27, // Al-Hadid

  // Juz 28: Surahs 58-66
  58: 28, // Al-Mujadila
  59: 28, // Al-Hashr
  60: 28, // Al-Mumtahina
  61: 28, // As-Saff
  62: 28, // Al-Jumu'a
  63: 28, // Al-Munafiqun
  64: 28, // At-Taghabun
  65: 28, // At-Talaq
  66: 28, // At-Tahrim

  // Juz 29: Surahs 67-77
  67: 29, // Al-Mulk
  68: 29, // Al-Qalam
  69: 29, // Al-Haaqqa
  70: 29, // Al-Ma'arij
  71: 29, // Nuh
  72: 29, // Al-Jinn
  73: 29, // Al-Muzzammil
  74: 29, // Al-Muddaththir
  75: 29, // Al-Qiyama
  76: 29, // Al-Insan
  77: 29, // Al-Mursalat

  // Juz 30 (Juz 'Amma): Surahs 78-114
  78: 30, // An-Naba
  79: 30, // An-Nazi'at
  80: 30, // 'Abasa
  81: 30, // At-Takwir
  82: 30, // Al-Infitar
  83: 30, // Al-Mutaffifin
  84: 30, // Al-Inshiqaq
  85: 30, // Al-Buruj
  86: 30, // At-Tariq
  87: 30, // Al-A'la
  88: 30, // Al-Ghashiya
  89: 30, // Al-Fajr
  90: 30, // Al-Balad
  91: 30, // Ash-Shams
  92: 30, // Al-Layl
  93: 30, // Ad-Duha
  94: 30, // Ash-Sharh
  95: 30, // At-Tin
  96: 30, // Al-'Alaq
  97: 30, // Al-Qadr
  98: 30, // Al-Bayyina
  99: 30, // Az-Zalzala
  100: 30, // Al-'Adiyat
  101: 30, // Al-Qari'a
  102: 30, // At-Takathur
  103: 30, // Al-'Asr
  104: 30, // Al-Humaza
  105: 30, // Al-Fil
  106: 30, // Quraysh
  107: 30, // Al-Ma'un
  108: 30, // Al-Kawthar
  109: 30, // Al-Kafirun
  110: 30, // An-Nasr
  111: 30, // Al-Masad
  112: 30, // Al-Ikhlas
  113: 30, // Al-Falaq
  114: 30, // An-Nas
};

/**
 * Get the Juz number for a given surah
 * @param surahId - The surah ID (1-114)
 * @returns The Juz number (1-30) where the surah starts
 */
export function getJuzForSurah(surahId: number): number {
  return SURAH_TO_JUZ[surahId] || 1;
}

/**
 * Get the display name for a Juz
 * @param juzNumber - The Juz number (1-30)
 * @returns The formatted Juz name
 */
export function getJuzName(juzNumber: number): string {
  if (juzNumber === 30) {
    return "Juz' 'Amma";
  }
  return `Juz' ${juzNumber}`;
}
