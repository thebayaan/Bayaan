// @ts-check
/**
 * Asset map: sign token ids -> LPMQ illustration files.
 *
 * Letter ids are the `letter` values of converter.mjs sign tokens (and the
 * keys of LETTERS_INFO); mark ids are what marks.mjs `markLayout` returns.
 * Files are produced by tools/extract_lpmq.py from the Pedoman PDF.
 *
 * Illustrations: LPMQ Kemenag RI, used for internal review pending
 * permission; not for distribution.
 */

const LETTER_IDS = [
  'alif',
  'ba',
  'ta',
  'tha',
  'jim',
  'hha',
  'kha',
  'dal',
  'dhal',
  'ra',
  'zay',
  'sin',
  'shin',
  'sad',
  'dad',
  'tta',
  'zza',
  'ain',
  'ghain',
  'fa',
  'qaf',
  'kaf',
  'lam',
  'mim',
  'nun',
  'waw',
  'ha',
  'lam_alif',
  'hamza',
  'ya',
  'alif_maqsura',
  'ta_marbuta',
  'hamza_tilawah',
];

const MARK_IDS = [
  'fathah',
  'kasrah',
  'dammah',
  'fathatain',
  'kasratain',
  'dammatain',
  'sukun',
  'shadda',
  'fathahTegak',
  'kasrahTegak',
  'dammahTerbalik',
  'madd',
  'sifr',
  'hamzaFathah',
  'hamzaFathahTegak',
  'hamzaKasrah',
  'hamzaKasrahTegak',
  'hamzaDammah',
  'hamzaDammahTerbalik',
  'hamzaFathatain',
  'hamzaKasratain',
  'hamzaDammatain',
];

/** @type {{letters: Record<string, string>, marks: Record<string, string>}} */
export const ASSET_MAP = {
  letters: Object.fromEntries(
    LETTER_IDS.map(id => [id, `assets/lpmq/letters/${id}.png`]),
  ),
  marks: Object.fromEntries(
    MARK_IDS.map(id => [id, `assets/lpmq/marks/${id}.png`]),
  ),
};

/**
 * Height in source pixels of a hand in the guideline's worked examples
 * (about 45 pt at 600 dpi). Mark glyphs come from those examples, so a mark
 * is drawn at (its source width) * (displayed hand height / this) to keep the
 * guideline's proportions. Letter-table hands are larger in the source; they
 * are always scaled to the displayed hand height.
 */
export const EXAMPLE_HAND_PX = 207;
