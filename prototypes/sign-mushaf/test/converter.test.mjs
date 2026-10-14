// Run from the repo root: node --test 'prototypes/sign-mushaf/test/*.test.mjs'
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {ASSET_MAP} from '../src/asset-map.mjs';
import {
  formatAyah,
  formatSign,
  toKitabah,
  toTilawah,
} from '../src/converter.mjs';
import {FATIHAH} from '../src/fatihah.mjs';
import {ALPHABET_ORDER, LETTERS_INFO} from '../src/letters.mjs';
import {MARK_ASSET_IDS, markLayout} from '../src/marks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const proto = join(here, '..');
const repo = join(proto, '..', '..');

/*
 * The guideline's worked example of Al-Fatihah (Pedoman, section II.F
 * "Kitabah" pp. 40 to 41 of the book, section II.G "Tilawah" pp. 42 to 43),
 * transcribed sign by sign from the drawings. Notation: letter:haraka, with
 * +shadda / +madd; words separated by " | ", waqf signs in brackets.
 */
const KITABAH_EXAMPLE = [
  'ba:kasrah sin:sukun mim:kasrah | alif lam lam:fathahTegak+shadda ha:kasrah | alif lam ra:fathah+shadda hha:sukun mim:fathahTegak nun:kasrah | alif lam ra:fathah+shadda hha:kasrah ya:sukun mim:kasrah',
  'alif:fathah lam:sukun hha:fathah mim:sukun dal:dammah | lam:kasrah lam:fathahTegak+shadda ha:kasrah | ra:fathah ba:kasrah+shadda | alif lam:sukun ain:fathahTegak lam:fathah mim:kasrah ya:sukun nun:fathah [لا]',
  'alif lam ra:fathah+shadda hha:sukun mim:fathahTegak nun:kasrah | alif lam ra:fathah+shadda hha:kasrah ya:sukun mim:kasrah [لا]',
  'mim:fathahTegak lam:kasrah kaf:kasrah | ya:fathah waw:sukun mim:kasrah | alif lam dal:kasrah+shadda ya:sukun nun:kasrah [قلى]',
  'alif:kasrah ya:fathah+shadda alif kaf:fathah | nun:fathah ain:sukun ba:dammah dal:dammah | waw:fathah alif:kasrah ya:fathah+shadda alif kaf:fathah | nun:fathah sin:sukun ta:fathah ain:kasrah ya:sukun nun:dammah [قلى]',
  'alif:kasrah ha:sukun dal:kasrah nun:fathah alif | alif lam sad:kasrah+shadda ra:fathah alif tta:fathah | alif lam:sukun mim:dammah sin:sukun ta:fathah qaf:kasrah ya:sukun mim:fathah [لا]',
  'sad:kasrah ra:fathah alif tta:fathah | alif lam:fathah+shadda dhal:kasrah ya:sukun nun:fathah | alif:fathah nun:sukun ain:fathah mim:sukun ta:fathah | ain:fathah lam:fathah ya:sukun ha:kasrah mim:sukun [لا][۵] | ghain:fathah ya:sukun ra:kasrah | alif lam:sukun mim:fathah ghain:sukun dad:dammah waw:sukun ba:kasrah | ain:fathah lam:fathah ya:sukun ha:kasrah mim:sukun | waw:fathah lam:fathah alif | alif lam dad:fathah+shadda+madd alif lam:kasrah+shadda ya:sukun nun:fathah',
];

const TILAWAH_EXAMPLE = [
  'ba:kasrah sin:sukun mim:kasrah | lam:fathahTegak+shadda ha:kasrah | ra:fathah+shadda hha:sukun mim:fathahTegak nun:kasrah | ra:fathah+shadda hha:kasrahTegak mim:sukun',
  'alif:fathah lam:sukun hha:fathah mim:sukun dal:dammah | lam:kasrah lam:fathahTegak+shadda ha:kasrah | ra:fathah ba:kasrah+shadda | lam:sukun ain:fathahTegak lam:fathah mim:kasrahTegak nun:sukun [لا]',
  'alif:fathah ra:fathah+shadda hha:sukun mim:fathahTegak nun:kasrah | ra:fathah+shadda hha:kasrahTegak mim:sukun [لا]',
  'mim:fathahTegak lam:kasrah kaf:kasrah | ya:fathah waw:sukun mim:kasrah | dal:kasrahTegak+shadda nun:sukun [قلى]',
  'alif:kasrah ya:fathahTegak+shadda kaf:fathah | nun:fathah ain:sukun ba:dammah dal:dammah | waw:fathah alif:kasrah ya:fathahTegak+shadda kaf:fathah | nun:fathah sin:sukun ta:fathah ain:kasrahTegak nun:sukun [قلى]',
  'alif:kasrah ha:sukun dal:kasrah nun:fathah | sad:kasrah+shadda ra:fathahTegak tta:fathah | lam:sukun mim:dammah sin:sukun ta:fathah qaf:kasrahTegak mim:sukun [لا]',
  'sad:kasrah ra:fathahTegak tta:fathah | lam:fathah+shadda dhal:kasrahTegak nun:fathah | alif:fathah nun:sukun ain:fathah mim:sukun ta:fathah | ain:fathah lam:fathah ya:sukun ha:kasrah mim:sukun [لا][۵] | ghain:fathah ya:sukun ra:kasrah | lam:sukun mim:fathah ghain:sukun dad:dammahTerbalik ba:kasrah | ain:fathah lam:fathah ya:sukun ha:kasrah mim:sukun | waw:fathah lam:fathah | dad:fathah+shadda+madd lam:kasrahTegak+shadda nun:sukun',
];

/** Split a formatted ayah into words, dropping waqf marks. */
function wordsOf(s) {
  return s.split(' | ').map(w => w.replace(/ ?\[[^\]]*\]/g, ''));
}

/**
 * Where Bayaan's Madani text is spelled differently from the MSI text the
 * example signs, Kitabah (sign what is written) must differ. Each entry is
 * [ayah, word index, Kitabah output for the Madani spelling, reason].
 */
const KITABAH_MADANI_DIFFS = [
  [
    2,
    0,
    'alif lam:sukun hha:fathah mim:sukun dal:dammah',
    'Madani writes ٱ (wasla, no haraka); MSI writes اَ with fathah',
  ],
  [
    6,
    0,
    'alif ha:sukun dal:kasrah nun:fathah alif',
    'Madani writes ٱ; MSI writes اِ with kasrah',
  ],
  [
    6,
    1,
    'alif lam sad:kasrah+shadda ra:fathahTegak tta:fathah',
    'Madani ٱلصِّرَٰطَ has a dagger alif; MSI writes a full alif',
  ],
  [
    7,
    0,
    'sad:kasrah ra:fathahTegak tta:fathah',
    'Madani صِرَٰطَ has a dagger alif; MSI writes a full alif',
  ],
];

test('fatihah.mjs carries Bayaan’s own text unchanged', () => {
  const quran = JSON.parse(
    readFileSync(join(repo, 'data', 'quran.json'), 'utf8'),
  );
  for (const a of FATIHAH)
    assert.equal(a.qpc, quran[String(a.number)].text, `ayah ${a.number}`);
});

test('Kitabah of the guideline’s MSI text matches the worked example sign by sign', () => {
  FATIHAH.forEach((a, i) => {
    const out = toKitabah(a.msi);
    assert.equal(out.number, a.number);
    assert.equal(formatAyah(out), KITABAH_EXAMPLE[i], `ayah ${a.number}`);
  });
});

test('Tilawah of the guideline’s MSI text matches the worked example sign by sign', () => {
  FATIHAH.forEach((a, i) => {
    assert.equal(
      formatAyah(toTilawah(a.msi)),
      TILAWAH_EXAMPLE[i],
      `ayah ${a.number}`,
    );
  });
});

test('Kitabah of Bayaan’s Madani text matches the example except where the spelling differs', () => {
  FATIHAH.forEach((a, i) => {
    const got = wordsOf(formatAyah(toKitabah(a.qpc)));
    const want = wordsOf(KITABAH_EXAMPLE[i]);
    assert.equal(got.length, want.length, `ayah ${a.number} word count`);
    got.forEach((w, wi) => {
      const diff = KITABAH_MADANI_DIFFS.find(
        d => d[0] === a.number && d[1] === wi,
      );
      assert.equal(
        w,
        diff ? diff[2] : want[wi],
        `ayah ${a.number} word ${wi + 1}${diff ? ` (${diff[3]})` : ''}`,
      );
    });
  });
});

test('Tilawah of Bayaan’s Madani text matches the example exactly (waqf signs aside)', () => {
  FATIHAH.forEach((a, i) => {
    assert.deepEqual(
      wordsOf(formatAyah(toTilawah(a.qpc))),
      wordsOf(TILAWAH_EXAMPLE[i]),
      `ayah ${a.number}`,
    );
  });
});

/** @param {string} text */
const k = text => formatAyah(toKitabah(text));
/** @param {string} text @param {object} [o] */
const t = (text, o) => formatAyah(toTilawah(text, o));

test('Kitabah rules on other Uthmani features', () => {
  // tatweel is skipped; small high rounded zero (sifr) is signed still
  assert.equal(
    k('قَوَارِيرَا۟'),
    'qaf:fathah waw:fathah alif ra:kasrah ya:sukun ra:fathah alif+sifr',
  );
  // dagger alif on alif maqsura moves to the letter before (عَلَىٰ)
  assert.equal(k('عَلَىٰ'), 'ain:fathah lam:fathahTegak alif_maqsura');
  // ta marbuta and hamza on its own
  assert.equal(
    k('رَحۡمَةٌ'),
    'ra:fathah hha:sukun mim:fathah ta_marbuta:dammatain',
  );
  assert.equal(k('سَمَآءٍ'), 'sin:fathah mim:fathah+madd alif hamza:kasratain');
  // hamza inside a word stays hamza; at the start (after a one-letter proclitic) it is written and signed as alif
  assert.equal(
    k('يُؤۡمِنُونَ'),
    'ya:dammah hamza:sukun mim:kasrah nun:dammah waw:sukun nun:fathah',
  );
  assert.equal(
    k('فَأَنزَلۡنَا'),
    'fa:fathah alif:fathah nun zay:fathah lam:sukun nun:fathah alif',
  );
  // small ya after ha (ha of kinayah): long kasrah, as in the "rabbihī" example
  assert.equal(k('بِهِۦ'), 'ba:kasrah ha:kasrahTegak');
  // iqlab: the small mim is not signed and the nun has no mark (example "mim ba'di", p. 39)
  assert.equal(
    k('مِنۢ بَعۡدِ'),
    'mim:kasrah nun | ba:fathah ain:sukun dal:kasrah',
  );
  // waqf marks attached to a word are kept as marks
  assert.equal(k('رَيۡبَۛ'), 'ra:fathah ya:sukun ba:fathah [∴]');
});

test('Tilawah rules on other cases from the guideline tables', () => {
  // iqlab: nun becomes mim held 2 beats (II.D.2 row 4, example "mim ba'di")
  assert.equal(
    t('مِنۢ بَعۡدِ', {stopAtEnd: false}),
    'mim:kasrah mim+hold | ba:fathah ain:sukun dal:kasrah',
  );
  // idgham across words: nun dropped, next letter takes shadda ("mir rizqin")
  assert.equal(
    t('مِن رِّزۡقٍ'),
    'mim:kasrah | ra:kasrah+shadda zay:sukun qaf:sukun+qalqalah',
  );
  // ikhfa: held 2 beats
  assert.equal(
    t('مِن قَبۡلُ', {stopAtEnd: false}),
    'mim:kasrah nun+hold | qaf:fathah ba:sukun+qalqalah lam:dammah',
  );
  // mad iwad at a stop (II.E row 9, "afwājā")
  assert.equal(
    t('أَفۡوَاج\u08F0ا'),
    'alif:fathah fa:sukun waw:fathahTegak jim:fathahTegak',
  );
  // ta marbuta at a stop is read as ha with sukun (II.E row 11)
  assert.equal(
    t('ٱلۡقَارِعَةُ'),
    'alif:fathah lam:sukun qaf:fathahTegak ra:kasrah ain:fathah ha:sukun',
  );
  // alif maqsura is not signed in Tilawah; the fathah before it is long (II.E row 12)
  assert.equal(
    t('وَٱلضُّحَىٰ'),
    'waw:fathah dad:dammah+shadda hha:fathahTegak',
  );
  // sifr letters are not signed in Tilawah (II.C row 15)
  assert.equal(
    t('قَوَارِيرَا۟', {stopAtEnd: false}),
    'qaf:fathah waw:fathahTegak ra:kasrahTegak ra:fathah',
  );
  // hamza uses the Tilawah handshape
  assert.equal(
    t('يُؤۡمِنُونَ'),
    'ya:dammah hamza_tilawah:sukun mim:kasrah nun:dammahTerbalik nun:sukun',
  );
});

test('every sign the converter can emit has an LPMQ illustration', () => {
  for (const id of ALPHABET_ORDER) {
    assert.ok(LETTERS_INFO[id], `letter info ${id}`);
    assert.ok(ASSET_MAP.letters[id], `asset map entry for letter ${id}`);
    assert.ok(
      existsSync(join(proto, ASSET_MAP.letters[id])),
      `file for letter ${id}`,
    );
  }
  for (const id of MARK_ASSET_IDS) {
    assert.ok(ASSET_MAP.marks[id], `asset map entry for mark ${id}`);
    assert.ok(
      existsSync(join(proto, ASSET_MAP.marks[id])),
      `file for mark ${id}`,
    );
  }
  // all letters and marks used by Al-Fatihah in both methods and both spellings
  for (const a of FATIHAH)
    for (const text of [a.qpc, a.msi])
      for (const out of [toKitabah(text), toTilawah(text)])
        for (const w of out.words)
          for (const s of w.signs) {
            assert.ok(
              ASSET_MAP.letters[s.letter],
              `letter ${s.letter} (${formatSign(s)})`,
            );
            const {above, below} = markLayout(s);
            for (const m of [...above, ...below])
              assert.ok(ASSET_MAP.marks[m], `mark ${m} (${formatSign(s)})`);
          }
});

test('mark layout follows the guideline: vowel above or below, shadda nearest the hand', () => {
  const base = {
    letter: 'ba',
    vowel: null,
    shadda: false,
    madd: false,
    sifr: false,
    hold: false,
    qalqalah: false,
  };
  assert.deepEqual(markLayout({...base, vowel: 'kasrah', shadda: true}), {
    above: [],
    below: ['shadda', 'kasrah'],
    badges: [],
  });
  assert.deepEqual(
    markLayout({...base, vowel: 'fathah', madd: true, shadda: true}),
    {above: ['madd'], below: ['shadda'], badges: []},
  );
  assert.deepEqual(markLayout({...base, letter: 'hamza', vowel: 'kasrah'}), {
    above: [],
    below: ['hamzaKasrah'],
    badges: [],
  });
  assert.deepEqual(markLayout({...base, letter: 'hamza', vowel: 'sukun'}), {
    above: [],
    below: [],
    badges: [],
  });
});

test('no em dash anywhere in the prototype sources', () => {
  for (const f of [
    'converter.mjs',
    'marks.mjs',
    'letters.mjs',
    'page.mjs',
    'fatihah.mjs',
    'index.template.html',
    'asset-map.mjs',
  ]) {
    assert.ok(
      !readFileSync(join(proto, 'src', f), 'utf8').includes(
        String.fromCharCode(0x2014),
      ),
      f,
    );
  }
});
