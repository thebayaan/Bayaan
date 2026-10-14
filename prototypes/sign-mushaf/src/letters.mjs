// @ts-check
/**
 * The LPMQ Arabic manual alphabet (Pedoman Membaca Mushaf Al-Qur'an Isyarat,
 * Kemenag RI 2022, section II.B, letter table rows 1 to 32), plus the Tilawah
 * form of hamza (section II.D.2).
 *
 * Each id is a sign token letter id produced by converter.mjs and a key of
 * the asset map (assets/lpmq/letters/<id>.png, LPMQ's own drawing).
 * `description` is our plain-English summary of the guideline's Indonesian
 * text. `movement` is set when the letter itself moves (hamza, alif maqsura);
 * it is data for the future animation phase.
 */

/**
 * @typedef {object} Letter
 * @property {string} id
 * @property {string} char Arabic character(s)
 * @property {string} name transliterated name as in the guideline
 * @property {number} lpmqNo row in the guideline's letter table (0 = not in the table)
 * @property {'out'|'in'|'left'|'right'|'down'|'up'} palm palm facing in the guideline text (signer's frame)
 * @property {string} description
 * @property {object|null} movement
 * @property {string[]} [sequence] compound sign signed as these letters in order (lam-alif)
 * @property {string} [notes]
 */

/** @type {Record<string, Letter>} */
export const LETTERS_INFO = {
  alif: {
    id: 'alif',
    char: 'ا',
    name: 'alif',
    lpmqNo: 1,
    palm: 'left',
    description:
      'Fist with the thumb pointing straight up, palm turned to the signer’s left (a thumbs-up).',
    movement: null,
  },
  ba: {
    id: 'ba',
    char: 'ب',
    name: 'ba',
    lpmqNo: 2,
    palm: 'out',
    description:
      'Palm facing out, fist with only the index finger straight up (one finger for one dot).',
    movement: null,
  },
  ta: {
    id: 'ta',
    char: 'ت',
    name: 'ta',
    lpmqNo: 3,
    palm: 'out',
    description:
      'Palm facing out, index and middle fingers straight up and together (two dots).',
    movement: null,
  },
  tha: {
    id: 'tha',
    char: 'ث',
    name: 'ṡa',
    lpmqNo: 4,
    palm: 'out',
    description:
      'Palm facing out, index, middle and ring fingers straight up and together (three dots); thumb holds the little finger.',
    movement: null,
  },
  jim: {
    id: 'jim',
    char: 'ج',
    name: 'jim',
    lpmqNo: 5,
    palm: 'left',
    description:
      'Palm to the signer’s left, the four fingers bent at a right angle at the knuckles; thumb bent underneath them (the dot below jim).',
    movement: null,
  },
  hha: {
    id: 'hha',
    char: 'ح',
    name: 'ḥa',
    lpmqNo: 6,
    palm: 'left',
    description:
      'Palm to the signer’s left, the four fingers bent at a right angle; thumb pressed against the base of the index finger.',
    movement: null,
  },
  kha: {
    id: 'kha',
    char: 'خ',
    name: 'kha',
    lpmqNo: 7,
    palm: 'left',
    description:
      'Palm to the signer’s left, the four fingers bent at a right angle; thumb straight up above them (the dot above kha).',
    movement: null,
    notes:
      'The text says the thumb points up "facing out"; the drawing shows it upright above the bent fingers.',
  },
  dal: {
    id: 'dal',
    char: 'د',
    name: 'dal',
    lpmqNo: 8,
    palm: 'left',
    description:
      'Palm to the signer’s left, fist except the thumb and index finger, which point straight to the signer’s left (shape of dal).',
    movement: null,
  },
  dhal: {
    id: 'dhal',
    char: 'ذ',
    name: 'żal',
    lpmqNo: 9,
    palm: 'left',
    description:
      'As dal (thumb and index pointing to the signer’s left), with the middle finger resting on top of the index (the dot above dhal).',
    movement: null,
  },
  ra: {
    id: 'ra',
    char: 'ر',
    name: 'ra',
    lpmqNo: 10,
    palm: 'left',
    description:
      'Palm to the signer’s left, fist except the index finger, which is curved like the stroke of ra.',
    movement: null,
  },
  zay: {
    id: 'zay',
    char: 'ز',
    name: 'zai',
    lpmqNo: 11,
    palm: 'left',
    description:
      'As ra (curved index finger), with the middle finger resting on the index (the dot above zay).',
    movement: null,
  },
  sin: {
    id: 'sin',
    char: 'س',
    name: 'sin',
    lpmqNo: 12,
    palm: 'out',
    description:
      'Flat hand, palm facing out, fingers straight and together pointing up (the teeth of sin).',
    movement: null,
  },
  shin: {
    id: 'shin',
    char: 'ش',
    name: 'syin',
    lpmqNo: 13,
    palm: 'out',
    description:
      'Palm facing out, the four fingers straight up and spread apart; thumb pressed against the index.',
    movement: null,
  },
  sad: {
    id: 'sad',
    char: 'ص',
    name: 'ṣad',
    lpmqNo: 14,
    palm: 'out',
    description:
      'Palm facing out, closed fist with the thumb wrapped across the front of the fingers.',
    movement: null,
  },
  dad: {
    id: 'dad',
    char: 'ض',
    name: 'ḍad',
    lpmqNo: 15,
    palm: 'out',
    description:
      'Palm facing out, closed fist with the thumb sticking out to the signer’s left (the dot of dad).',
    movement: null,
  },
  tta: {
    id: 'tta',
    char: 'ط',
    name: 'ṭa',
    lpmqNo: 16,
    palm: 'left',
    description:
      'Palm to the signer’s left, ring and little fingers closed, middle fingertip touching the thumb tip, index straight up (shape of ta).',
    movement: null,
  },
  zza: {
    id: 'zza',
    char: 'ظ',
    name: 'ẓa',
    lpmqNo: 17,
    palm: 'left',
    description:
      'As ta, but the middle finger points straight to the signer’s left with the thumb resting on it (the dot of za); index straight up.',
    movement: null,
  },
  ain: {
    id: 'ain',
    char: 'ع',
    name: '‘ain',
    lpmqNo: 18,
    palm: 'in',
    description:
      'Palm facing the signer, index and middle fingers together pointing straight to the signer’s left; thumb laid on their middle segments.',
    movement: null,
  },
  ghain: {
    id: 'ghain',
    char: 'غ',
    name: 'gain',
    lpmqNo: 19,
    palm: 'in',
    description:
      'As ‘ain (index and middle pointing to the signer’s left), with the thumb pointing up against the index (the dot above ghain).',
    movement: null,
  },
  fa: {
    id: 'fa',
    char: 'ف',
    name: 'fa',
    lpmqNo: 20,
    palm: 'out',
    description:
      'Palm facing out, fist with the index fingertip curled to meet the thumb tip (the loop of fa).',
    movement: null,
  },
  qaf: {
    id: 'qaf',
    char: 'ق',
    name: 'qaf',
    lpmqNo: 21,
    palm: 'out',
    description:
      'Palm facing out, fist with the index and middle fingertips curled to meet the thumb tip (two dots of qaf).',
    movement: null,
  },
  kaf: {
    id: 'kaf',
    char: 'ك',
    name: 'kaf',
    lpmqNo: 22,
    palm: 'out',
    description:
      'Flat hand, palm facing out, fingers straight and together pointing up; thumb folded flat across the palm.',
    movement: null,
  },
  lam: {
    id: 'lam',
    char: 'ل',
    name: 'lam',
    lpmqNo: 23,
    palm: 'out',
    description:
      'Palm facing out, fist except the index straight up and the thumb pointing to the signer’s left (an L, the shape of lam).',
    movement: null,
  },
  mim: {
    id: 'mim',
    char: 'م',
    name: 'mim',
    lpmqNo: 24,
    palm: 'out',
    description:
      'Palm facing out, fist except the little finger, which stands straight up.',
    movement: null,
  },
  nun: {
    id: 'nun',
    char: 'ن',
    name: 'nun',
    lpmqNo: 25,
    palm: 'out',
    description:
      'Palm facing out, fist except the index finger and thumb, curved upward into a cup (the bowl of nun).',
    movement: null,
  },
  waw: {
    id: 'waw',
    char: 'و',
    name: 'waw',
    lpmqNo: 26,
    palm: 'left',
    description:
      'Palm to the signer’s left, the four fingers curled into a small ring with their tips on the base of the thumb; thumb points down (the tail of waw).',
    movement: null,
  },
  ha: {
    id: 'ha',
    char: 'ه',
    name: 'ha',
    lpmqNo: 27,
    palm: 'out',
    description:
      'Palm facing out, all four fingertips curled to meet the thumb tip, making a small closed ring (the round ha).',
    movement: null,
  },
  lam_alif: {
    id: 'lam_alif',
    char: 'لا',
    name: 'lam alif',
    lpmqNo: 28,
    palm: 'out',
    description: 'Signed as two letters in order: lam, then alif.',
    movement: null,
    sequence: ['lam', 'alif'],
  },
  hamza: {
    id: 'hamza',
    char: 'ء',
    name: 'hamzah',
    lpmqNo: 29,
    palm: 'out',
    description:
      'Palm facing out, fist with the index finger up; the fingertip draws the hamza shape in the air.',
    movement: {
      type: 'trace',
      shape: 'hamza',
      effector: 'index-finger-tip',
      beats: 1,
    },
    notes:
      'Same handshape as ba; the drawing adds the hamza traced in the air (red) and the starting position (grey).',
  },
  ya: {
    id: 'ya',
    char: 'ي',
    name: 'ya',
    lpmqNo: 30,
    palm: 'out',
    description:
      'Palm facing out, fist except the thumb and little finger, which point up and spread apart.',
    movement: null,
  },
  alif_maqsura: {
    id: 'alif_maqsura',
    char: 'ى',
    name: 'alif maqṣūrah',
    lpmqNo: 31,
    palm: 'out',
    description:
      'Handshape of ya (thumb and little finger out), with the wrist flicked inward twice.',
    movement: {
      type: 'wristFlex',
      direction: 'in',
      degrees: 25,
      repeat: 2,
      beats: 1,
    },
    notes:
      'The grey ghost hand in the drawing shows the inward wrist movement.',
  },
  ta_marbuta: {
    id: 'ta_marbuta',
    char: 'ة',
    name: 'ta marbuṭah',
    lpmqNo: 32,
    palm: 'out',
    description:
      'Palm facing out, fist except the index and middle fingers, curved and spread apart (the two dots above ta marbuta).',
    movement: null,
  },
  hamza_tilawah: {
    id: 'hamza_tilawah',
    char: 'ء',
    name: 'hamzah (Tilawah)',
    lpmqNo: 0,
    palm: 'down',
    description:
      'Tilawah form of hamza: palm facing down, fist with the index finger pointing straight forward; the haraka is drawn with the fingertip.',
    movement: null,
    notes:
      'Not in the letter table: cropped from the Tilawah hamza table (section II.D.2, first row), where the guideline draws it foreshortened.',
  },
};

/** Order of the alphabet grid on the page (the guideline's table order). */
export const ALPHABET_ORDER = [
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
