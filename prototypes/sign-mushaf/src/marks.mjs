// @ts-check
/**
 * Haraka and reading marks, after section II.C of the LPMQ guideline.
 *
 * Each mark has two faces:
 *   movement: a data descriptor of what the hand does (signer's frame). The
 *             animation phase turns these into keyframes on top of the base
 *             handshape.
 *   glyph:    how the page draws it: LPMQ's own mark glyph cropped from the
 *             guideline (assets/lpmq/marks/<id>.png), placed above or below
 *             the hand as the guideline does (see markLayout). The glyphs are
 *             drawn from the viewer's side, so the signer's "right to left"
 *             is an arrow pointing right.
 *
 * Directions in `movement` use the signer's frame: x = signer's left (+) /
 * right (-), y = up, z = toward the viewer ("out") (+) / toward the body (-).
 */

/**
 * @typedef {object} MovementStep
 * @property {'translate'|'arc'|'rotate'|'hold'|'stroke'|'bounce'} type
 * @property {number[]} [dir] Unit direction, signer frame
 * @property {number} [distance] Relative to hand length (1 = one hand length)
 * @property {number} [sag] Arc depth for `arc`, relative to distance
 * @property {string} [axis] For `rotate`: 'forearm'
 * @property {number} [degrees]
 * @property {number} [repeat]
 * @property {number} beats Duration in harakat/ketukan
 * @property {string} [handshape] Temporary handshape for the step (tanwin: 'tanwinV')
 */
/**
 * @typedef {object} MarkDef
 * @property {string} id
 * @property {string} name
 * @property {string} arabic Example glyph
 * @property {'above'|'below'|'none'} position Where the guideline draws it
 * @property {string} meaning Plain English
 * @property {MovementStep[]} movement
 */

/** @type {Record<string, MarkDef>} */
export const MARKS = {
  fathah: {
    id: 'fathah',
    name: 'Fathah',
    arabic: 'َ',
    position: 'above',
    meaning: 'Form the letter, then move the hand straight from right to left.',
    movement: [{type: 'translate', dir: [1, 0, 0], distance: 0.5, beats: 1}],
  },
  kasrah: {
    id: 'kasrah',
    name: 'Kasrah',
    arabic: 'ِ',
    position: 'below',
    meaning: 'Form the letter, then move the hand straight down.',
    movement: [{type: 'translate', dir: [0, -1, 0], distance: 0.5, beats: 1}],
  },
  dammah: {
    id: 'dammah',
    name: 'Dammah',
    arabic: 'ُ',
    position: 'above',
    meaning:
      'Form the letter, then move the hand in a downward curve from right to left.',
    movement: [
      {type: 'arc', dir: [1, 0, 0], distance: 0.5, sag: 0.4, beats: 1},
    ],
  },
  fathatain: {
    id: 'fathatain',
    name: 'Fathatain',
    arabic: 'ً',
    position: 'above',
    meaning:
      'As fathah, then with index and middle spread, draw two strokes from upper right to lower left while moving from out to in.',
    movement: [
      {type: 'translate', dir: [1, 0, 0], distance: 0.5, beats: 1},
      {
        type: 'stroke',
        handshape: 'tanwinV',
        dir: [0.7, -0.7, -0.3],
        distance: 0.3,
        repeat: 1,
        beats: 1,
      },
    ],
  },
  kasratain: {
    id: 'kasratain',
    name: 'Kasratain',
    arabic: 'ٍ',
    position: 'below',
    meaning:
      'As kasrah, then the two-finger double stroke (drawn below the letter).',
    movement: [
      {type: 'translate', dir: [0, -1, 0], distance: 0.5, beats: 1},
      {
        type: 'stroke',
        handshape: 'tanwinV',
        dir: [0.7, -0.7, -0.3],
        distance: 0.3,
        repeat: 1,
        beats: 1,
      },
    ],
  },
  dammatain: {
    id: 'dammatain',
    name: 'Dammatain',
    arabic: 'ٌ',
    position: 'above',
    meaning: 'As dammah, then the two-finger double curved stroke.',
    movement: [
      {type: 'arc', dir: [1, 0, 0], distance: 0.5, sag: 0.4, beats: 1},
      {
        type: 'stroke',
        handshape: 'tanwinV',
        dir: [0.7, -0.7, -0.3],
        distance: 0.3,
        repeat: 1,
        beats: 1,
      },
    ],
  },
  sukun: {
    id: 'sukun',
    name: 'Sukun',
    arabic: 'ۡ',
    position: 'above',
    meaning: 'Form the letter and hold it still.',
    movement: [{type: 'hold', beats: 1}],
  },
  shadda: {
    id: 'shadda',
    name: 'Tasydid',
    arabic: 'ّ',
    position: 'below',
    meaning:
      'Form the letter facing inward, turn the wrist outward once, then sign the haraka. Shadda comes before the haraka.',
    movement: [
      {type: 'rotate', axis: 'forearm', degrees: 90, repeat: 1, beats: 1},
    ],
  },
  fathahTegak: {
    id: 'fathahTegak',
    name: 'Fathah tegak (long a)',
    arabic: 'ٰ',
    position: 'above',
    meaning: 'As fathah, stretched over 2 beats.',
    movement: [{type: 'translate', dir: [1, 0, 0], distance: 0.8, beats: 2}],
  },
  kasrahTegak: {
    id: 'kasrahTegak',
    name: 'Kasrah tegak (long i)',
    arabic: 'ٖ',
    position: 'below',
    meaning: 'As kasrah, stretched over 2 beats.',
    movement: [{type: 'translate', dir: [0, -1, 0], distance: 0.8, beats: 2}],
  },
  dammahTerbalik: {
    id: 'dammahTerbalik',
    name: 'Dammah terbalik (long u)',
    arabic: 'ٗ',
    position: 'above',
    meaning: 'As dammah, stretched over 2 beats.',
    movement: [
      {type: 'arc', dir: [1, 0, 0], distance: 0.8, sag: 0.4, beats: 2},
    ],
  },
  madd: {
    id: 'madd',
    name: 'Tanda mad (madd sign)',
    arabic: 'ٓ',
    position: 'above',
    meaning:
      'The haraka of the letter is stretched to 4 or 5 beats (mad wajib, mad jaiz) or 6 beats (mad lazim).',
    movement: [{type: 'translate', dir: [1, 0, 0], distance: 1.1, beats: 5}],
  },
  sifr: {
    id: 'sifr',
    name: 'Tanda sifr',
    arabic: '۟',
    position: 'above',
    meaning:
      'Kitabah: signed still, like sukun. Tilawah: the letter is not signed.',
    movement: [{type: 'hold', beats: 1}],
  },
  qalqalah: {
    id: 'qalqalah',
    name: 'Qalqalah (Tilawah)',
    arabic: '',
    position: 'above',
    meaning: 'Tilawah: the qalqalah letter is bounced quickly forward.',
    movement: [{type: 'bounce', dir: [0, 0, 1], distance: 0.2, beats: 1}],
  },
  hold: {
    id: 'hold',
    name: 'Held 2 beats (Tilawah)',
    arabic: '',
    position: 'below',
    meaning: 'Tilawah ikhfa and iqlab: the letter is held for 2 beats.',
    movement: [{type: 'hold', beats: 2}],
  },
};

/** Vowel-type marks (at most one per sign). */
export const VOWELS = [
  'fathah',
  'kasrah',
  'dammah',
  'fathatain',
  'kasratain',
  'dammatain',
  'sukun',
  'fathahTegak',
  'kasrahTegak',
  'dammahTerbalik',
];

/** Long forms and tanwin drawn above the hand. */
const ABOVE = new Set([
  'fathah',
  'fathahTegak',
  'dammah',
  'dammahTerbalik',
  'fathatain',
  'dammatain',
  'sukun',
]);

/** Kitabah hamza: the haraka is a stroke drawn with the fingertip. */
const HAMZA_MARKS = /** @type {Record<string, [string, 'above'|'below']>} */ ({
  fathah: ['hamzaFathah', 'above'],
  fathahTegak: ['hamzaFathahTegak', 'above'],
  kasrah: ['hamzaKasrah', 'below'],
  kasrahTegak: ['hamzaKasrahTegak', 'below'],
  dammah: ['hamzaDammah', 'above'],
  dammahTerbalik: ['hamzaDammahTerbalik', 'above'],
  fathatain: ['hamzaFathatain', 'above'],
  kasratain: ['hamzaKasratain', 'below'],
  dammatain: ['hamzaDammatain', 'above'],
});

/**
 * Mark glyph asset ids for one sign, in the guideline's layout: fathah,
 * dammah, sukun and their long, tanwin and madd forms above the hand; shadda
 * and the kasrah forms below it (shadda nearest the hand). For the Kitabah
 * hamza the haraka is a fingertip stroke (section II.C, "Catatan mengenai
 * huruf hamzah"); hamza sukun has no mark. `badges` are marks the guideline
 * gives no glyph for (Tilawah hold and qalqalah); the page prints them as
 * small text.
 * @param {{letter: string, vowel: string|null, shadda: boolean, madd: boolean, sifr: boolean, hold: boolean, qalqalah: boolean}} t
 * @returns {{above: string[], below: string[], badges: string[]}}
 */
export function markLayout(t) {
  /** @type {string[]} */
  const above = [];
  /** @type {string[]} */
  const below = [];
  /** @type {string[]} */
  const badges = [];
  const v = t.vowel;
  if (t.letter === 'hamza') {
    const m = v ? HAMZA_MARKS[v] : null;
    if (m) (m[1] === 'above' ? above : below).push(m[0]);
    if (t.madd) above.push('madd');
  } else if (v === 'fathah' && t.madd) {
    above.push('madd'); // the madd glyph is the stretched fathah arrow (p. 23)
  } else if (v) {
    (ABOVE.has(v) ? above : below).push(v);
    if (t.madd) above.push('madd');
  } else if (t.madd) {
    above.push('madd');
  }
  if (t.sifr) above.push('sifr');
  if (t.shadda) below.unshift('shadda');
  if (t.hold) badges.push('hold 2');
  if (t.qalqalah) badges.push('qalqalah');
  return {above, below, badges};
}

/** Every mark glyph the page may need; the asset map must cover these. */
export const MARK_ASSET_IDS = [
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
