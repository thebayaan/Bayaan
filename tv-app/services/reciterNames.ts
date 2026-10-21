import type {Reciter} from '../types/reciter';
import ARABIC_NAMES from '../data/reciterArabicNames.json';

// Reciter names in Arabic from the phone's own name table (i18n/format.ts,
// via scripts/gen-reciter-arabic-names.py), not catalog data: the live
// catalog doesn't carry Arabic names yet. Keyed, like the phone's, by the
// English name's letters and digits, so it holds whatever ids the API uses.
const arabicNames = ARABIC_NAMES as Record<string, string>;

/** The reciter's Arabic name: the catalog's, else the phone's name table. */
export function reciterArabicName(reciter: Reciter): string | null {
  return (
    reciter.name_arabic ||
    arabicNames[reciter.name.toLowerCase().replace(/[^a-z0-9]/g, '')] ||
    null
  );
}
