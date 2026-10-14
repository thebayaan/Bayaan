// @ts-check
/**
 * Rule-based converter: Uthmani text of one ayah -> sequence of sign tokens,
 * after LPMQ's Pedoman Membaca Mushaf Al-Qur'an Isyarat (Kemenag RI, 2022).
 * No AI and no per-word tables (the one lexical rule is the lafz al-jalalah
 * pattern): every output comes from the rules
 * below, and every rule cites the guideline section it implements (or says
 * that the guideline is silent and which conservative choice was made; those
 * are also listed in NOTES.md).
 *
 * Two methods (section II.D):
 *   kitabah: sign every letter, haraka and mark as written in the mushaf.
 *   tilawah: sign as recited (unpronounced letters dropped, long vowels,
 *            stops, nun sakinah / tanwin rules, qalqalah).
 *
 * The guideline is written for the Mushaf Standar Indonesia (MSI). Bayaan's
 * text is the KFGQPC Hafs (Madani) Uthmani text, whose orthography differs in
 * places. `normalize` maps the Madani conventions onto what MSI writes where
 * the guideline's own examples show the MSI form (each mapping is listed in
 * NOTES.md); anything else is signed exactly as written.
 */

/**
 * @typedef {'fathah'|'kasrah'|'dammah'|'fathatain'|'kasratain'|'dammatain'|'sukun'|'fathahTegak'|'kasrahTegak'|'dammahTerbalik'} Vowel
 */
/**
 * @typedef {object} SignToken
 * @property {'sign'} type
 * @property {string} letter handshape id (handshapes.mjs)
 * @property {Vowel|null} vowel
 * @property {boolean} shadda
 * @property {boolean} madd haraka stretched 4 to 6 beats (tanda mad)
 * @property {boolean} sifr signed still (tanda sifr, Kitabah)
 * @property {boolean} hold held 2 beats (Tilawah ikhfa / iqlab)
 * @property {boolean} qalqalah bounced forward (Tilawah)
 * @property {string} src the written cluster this sign comes from
 */
/**
 * @typedef {object} MarkToken
 * @property {'waqf'} type
 * @property {string} glyph
 * @property {string} label
 */
/**
 * @typedef {object} WordOut
 * @property {string} text written word
 * @property {SignToken[]} signs
 * @property {MarkToken[]} marks waqf and other marks shown above the word
 */
/**
 * @typedef {object} AyahOut
 * @property {number|null} number
 * @property {WordOut[]} words
 * @property {string[]} log rule decisions taken while converting (for review)
 */

/* ------------------------------------------------------------------ */
/* Character classes                                                   */
/* ------------------------------------------------------------------ */

const LETTERS = /** @type {Record<string, string>} */ ({
  ا: 'alif',
  ٱ: 'alif', // alif wasla
  آ: 'alif', // alif with madda above (treated as alif + madd sign)
  ب: 'ba',
  ت: 'ta',
  ث: 'tha',
  ج: 'jim',
  ح: 'hha',
  خ: 'kha',
  د: 'dal',
  ذ: 'dhal',
  ر: 'ra',
  ز: 'zay',
  س: 'sin',
  ش: 'shin',
  ص: 'sad',
  ض: 'dad',
  ط: 'tta',
  ظ: 'zza',
  ع: 'ain',
  غ: 'ghain',
  ف: 'fa',
  ق: 'qaf',
  ك: 'kaf',
  ل: 'lam',
  م: 'mim',
  ن: 'nun',
  ه: 'ha',
  و: 'waw',
  ي: 'ya',
  ى: 'alif_maqsura',
  ة: 'ta_marbuta',
  ء: 'hamza',
  أ: 'hamza', // hamza on alif
  إ: 'hamza', // hamza under alif
  ؤ: 'hamza', // hamza on waw
  ئ: 'hamza', // hamza on ya
  ـ: 'tatweel',
});

/** @type {Record<string, Vowel>} */
const VOWEL_MARKS = {
  'َ': 'fathah',
  'ِ': 'kasrah',
  'ُ': 'dammah',
  'ً': 'fathatain',
  'ࣰ': 'fathatain', // open fathatan (QPC, ikhfa / idgham)
  'ٍ': 'kasratain',
  'ࣲ': 'kasratain', // open kasratan
  'ٌ': 'dammatain',
  'ࣱ': 'dammatain', // open dammatan
  'ْ': 'sukun',
  'ۡ': 'sukun', // QPC / MSI sukun (jazm head)
  'ٖ': 'kasrahTegak', // subscript alef
  'ٗ': 'dammahTerbalik', // inverted damma
};

const SHADDA = 'ّ';
const DAGGER_ALIF = 'ٰ';
const MADD_MARKS = new Set(['ٓ', 'ۤ']);
const SMALL_WAW = 'ۥ';
const SMALL_YA = new Set(['ۦ', 'ۧ']);
const SIFR = new Set(['۟', '۠']);
const IQLAB_MEEM = new Set(['ۢ', 'ۭ']);
const HAMZA_ABOVE = new Set(['ٔ', 'ٕ']);
/** Marks we read past without signing; each occurrence is logged (see NOTES.md). */
const IGNORED_MARKS = /** @type {Record<string, string>} */ ({
  'ۣ': 'small low seen (pronunciation note on sad/sin): base letter signed',
  'ۨ': 'small high noon (idgham note): not signed',
  '۪': 'empty centre low stop (imala): not signed',
  '۫': 'empty centre high stop (ishmam): not signed',
  '۬': 'rounded high stop with filled centre (tashil): not signed',
  'ۜ': 'small high seen (saktah / sad-as-sin note): not signed',
  'ؕ': 'small high tah: not signed',
});

/** Waqf and other reading marks, shown above the word (MSI draws them over the hands). */
const WAQF = /** @type {Record<string, string>} */ ({
  'ۖ': 'صلى',
  'ۗ': 'قلى',
  'ۘ': 'م',
  'ۙ': 'لا',
  'ۚ': 'ج',
  'ۛ': '∴',
  '۞': '۞',
  '۩': '۩',
  // MSI marks an ayah boundary of other counting systems (ayah 7 of
  // al-Fatihah, after the first عليهم) with this sign; it is not signed.
  '۵': '۵',
});

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} Cluster
 * @property {string} base the written base character
 * @property {string} letter handshape id
 * @property {Vowel|null} vowel
 * @property {boolean} shadda
 * @property {boolean} dagger
 * @property {boolean} madd madd sign written on this letter
 * @property {boolean} smallWaw
 * @property {boolean} smallYa
 * @property {boolean} sifr
 * @property {boolean} iqlab
 * @property {boolean} hamzaMark
 * @property {string} src
 * @property {boolean} wasla
 * @property {boolean} maddLetter normalization: a vowel-less alif / waw / ya / alif maqsura that lengthens the previous vowel
 * @property {boolean} maddCarrier normalization: letter whose madd sign moved to the previous letter
 * @property {boolean} dropKitabah normalization: merged into the previous sign (not signed in either method)
 */

/**
 * @param {string} word
 * @param {string[]} log
 * @returns {{clusters: Cluster[], marks: MarkToken[]}}
 */
function parseWord(word, log) {
  /** @type {Cluster[]} */
  const clusters = [];
  /** @type {MarkToken[]} */
  const marks = [];
  for (const ch of word) {
    if (ch in LETTERS) {
      clusters.push({
        base: ch,
        letter: LETTERS[ch],
        vowel: null,
        shadda: false,
        dagger: false,
        madd: ch === 'آ',
        smallWaw: false,
        smallYa: false,
        sifr: false,
        iqlab: false,
        hamzaMark: false,
        src: ch,
        wasla: ch === 'ٱ',
        maddLetter: false,
        maddCarrier: false,
        dropKitabah: false,
      });
      continue;
    }
    if (ch in WAQF) {
      marks.push({type: 'waqf', glyph: ch, label: WAQF[ch]});
      continue;
    }
    const c = clusters[clusters.length - 1];
    if (!c) {
      log.push(
        `ignored leading mark U+${ch
          .codePointAt(0)
          ?.toString(16)
          .toUpperCase()}`,
      );
      continue;
    }
    c.src += ch;
    if (ch in VOWEL_MARKS) c.vowel = VOWEL_MARKS[ch];
    else if (ch === SHADDA) c.shadda = true;
    else if (ch === DAGGER_ALIF) c.dagger = true;
    else if (MADD_MARKS.has(ch)) c.madd = true;
    else if (ch === SMALL_WAW) c.smallWaw = true;
    else if (SMALL_YA.has(ch)) c.smallYa = true;
    else if (SIFR.has(ch)) c.sifr = true;
    else if (IQLAB_MEEM.has(ch)) c.iqlab = true;
    else if (HAMZA_ABOVE.has(ch)) c.hamzaMark = true;
    else if (ch in IGNORED_MARKS)
      log.push(
        `U+${ch.codePointAt(0)?.toString(16).toUpperCase()} ${
          IGNORED_MARKS[ch]
        }`,
      );
    else
      log.push(
        `unknown mark U+${ch
          .codePointAt(0)
          ?.toString(16)
          .toUpperCase()} ignored`,
      );
  }
  return {clusters, marks};
}

/* ------------------------------------------------------------------ */
/* Normalization: Madani (QPC) orthography -> what MSI writes           */
/* ------------------------------------------------------------------ */

/** Skeleton of a word (letters only, wasla as plain alif). */
function skeleton(/** @type {Cluster[]} */ cl) {
  return cl.map(c => (c.base === 'ٱ' ? 'ا' : c.base)).join('');
}

/** Lafz al-jalalah with or without a one-letter prefix: الله لله بالله والله فالله تالله اللهم ... */
const ALLAH_RE = /^(?:[وف]?(?:ب|ت|ل|أب)?)?(?:ا?لله|لله)(?:م)?$/;

const PROCLITIC_OK = new Set(['waw', 'fa', 'ba', 'lam', 'kaf']);

/**
 * @param {Cluster[]} cl clusters of one word
 * @param {string[]} log
 */
function normalizeWord(cl, log) {
  // tatweel: a seat for hamza (ـٔ) or nothing
  for (const c of cl) {
    if (c.letter !== 'tatweel') continue;
    if (c.hamzaMark) c.letter = 'hamza';
    else c.dropKitabah = true;
  }
  const cs = cl.filter(c => !c.dropKitabah);

  // Hamza-on-alif at the start of a word (or after a one-letter proclitic) is
  // written by MSI as a bare alif with its haraka (اِيَّاكَ, وَاِيَّاكَ, اَنْعَمْتَ),
  // and the guideline's examples sign it as alif.
  for (let i = 0; i < Math.min(cs.length, 2); i++) {
    const c = cs[i];
    const initial =
      i === 0 ||
      (i === 1 &&
        PROCLITIC_OK.has(cs[0].letter) &&
        cs[0].vowel !== null &&
        !cs[0].shadda);
    if (!initial) break;
    if (c.base === 'أ' || c.base === 'إ') {
      c.letter = 'alif';
      log.push(
        `${c.src}: word-initial hamza on alif signed as alif with its haraka (MSI writes a bare alif)`,
      );
    }
  }
  // Word-initial ءَا (Madani) = اٰ in MSI: one alif with fathah tegak (example "Āmana", p. 30).
  if (
    cs.length >= 2 &&
    cs[0].base === 'ء' &&
    cs[0].vowel === 'fathah' &&
    cs[1].base === 'ا' &&
    !cs[1].vowel
  ) {
    cs[0].letter = 'alif';
    cs[0].vowel = 'fathahTegak';
    cs[1].dropKitabah = true;
    if (cs[1].madd) cs[0].madd = true;
    log.push(
      `${cs[0].src}${cs[1].src}: initial hamza + alif written as alif with fathah tegak (MSI)`,
    );
  }

  // MSI writes hamzat al-wasl of the article as a bare alif (الرَّحْمٰنِ,
  // الَّذِيْنَ): a vowel-less alif opening the word (or following a one-letter
  // proclitic) before lam is an alif wasla.
  for (let i = 0; i < Math.min(cs.length - 1, 2); i++) {
    const c = cs[i];
    const initial =
      i === 0 ||
      (PROCLITIC_OK.has(cs[0].letter) && cs[0].vowel !== null && !cs[0].shadda);
    const lam = cs[i + 1];
    const articleLam =
      lam.letter === 'lam' &&
      (lam.vowel === null || lam.vowel === 'sukun' || lam.shadda);
    if (initial && c.base === 'ا' && !c.vowel && !c.madd && articleLam)
      c.wasla = true;
    if (!initial) break;
  }

  const live = cs.filter(c => !c.dropKitabah);
  for (let i = 0; i < live.length; i++) {
    const c = live[i];
    const prev = i > 0 ? live[i - 1] : null;

    // Dagger alif (fathah tegak).
    if (c.dagger) {
      const carrier =
        ['waw', 'ya', 'alif_maqsura', 'alif'].includes(c.letter) &&
        !c.vowel &&
        !c.shadda;
      if (carrier && prev && (prev.vowel === 'fathah' || prev.vowel === null)) {
        // e.g. عَلَىٰ, ٱلصَّلَوٰةَ: MSI puts the vertical fathah on the letter before
        prev.vowel = 'fathahTegak';
        if (c.madd) {
          prev.madd = true;
          c.madd = false;
        }
        c.maddLetter = true;
        log.push(
          `${prev.src}${c.src}: dagger alif on a carrier moved to the previous letter as fathah tegak`,
        );
      } else {
        c.vowel = 'fathahTegak';
      }
    }
    // Small waw / ya after a haraka (ha of kinayah, بِهِۦ): long vowel (example "rabbihī", p. 22).
    if (c.smallYa && (c.vowel === 'kasrah' || c.vowel === null))
      c.vowel = 'kasrahTegak';
    if (c.smallWaw && (c.vowel === 'dammah' || c.vowel === null))
      c.vowel = 'dammahTerbalik';

    // Madd sign on a carrier letter: the stretched haraka belongs to the letter before (example "aḍ-ḍāllīn", p. 23).
    if (
      c.madd &&
      prev &&
      ['alif', 'waw', 'ya', 'alif_maqsura'].includes(c.letter) &&
      !c.vowel &&
      !c.shadda
    ) {
      prev.madd = true;
      c.madd = false;
      c.maddCarrier = true;
    }

    // Long-vowel letters. Madani leaves madd ya / waw unmarked; MSI writes a
    // sukun on them (الرَّحِيْمِ, الْمَغْضُوْبِ) and nothing on madd alif, and the
    // guideline signs exactly that in Kitabah.
    const plain =
      !c.shadda &&
      !c.sifr &&
      !c.dagger &&
      !c.madd &&
      !c.wasla &&
      (c.vowel === null || c.vowel === 'sukun');
    if (plain && prev && !c.maddLetter) {
      if (
        c.letter === 'ya' &&
        (prev.vowel === 'kasrah' || prev.vowel === 'kasrahTegak')
      ) {
        c.vowel = 'sukun';
        c.maddLetter = true;
      } else if (
        c.letter === 'waw' &&
        (prev.vowel === 'dammah' || prev.vowel === 'dammahTerbalik')
      ) {
        c.vowel = 'sukun';
        c.maddLetter = true;
      } else if (
        c.vowel === null &&
        (c.letter === 'alif' || c.letter === 'alif_maqsura') &&
        (prev.vowel === 'fathah' || prev.vowel === 'fathahTegak')
      ) {
        c.maddLetter = true;
      } else if (
        c.vowel === null &&
        c.letter === 'alif' &&
        prev.vowel === 'fathatain'
      ) {
        c.maddLetter = true; // alif after tanwin fathah (mad iwad at a stop)
      }
    }
  }

  // Lafz al-jalalah: MSI always writes a vertical fathah on the doubled lam (اللّٰهِ, examples pp. 29, 40).
  if (ALLAH_RE.test(skeleton(live))) {
    for (const c of live) {
      if (c.letter === 'lam' && c.shadda && c.vowel === 'fathah') {
        c.vowel = 'fathahTegak';
        log.push(
          `${c.src}: lafz al-jalalah, lam signed with fathah tegak as MSI writes it`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

/**
 * @param {Cluster} c
 * @returns {SignToken}
 */
function signOf(c) {
  return {
    type: 'sign',
    letter: c.letter,
    vowel: c.vowel,
    shadda: c.shadda,
    madd: c.madd,
    sifr: c.sifr,
    hold: false,
    qalqalah: false,
    src: c.src,
  };
}

/**
 * Split an ayah into words and an optional trailing ayah number.
 * @param {string} text
 * @returns {{words: string[], number: number|null}}
 */
function splitAyah(text) {
  const parts = text.split(/[\s ]+/).filter(Boolean);
  let number = null;
  const last = parts[parts.length - 1];
  if (
    last &&
    [...last].every(
      ch => ARABIC_INDIC_DIGITS.includes(ch) || /[0-9]/.test(ch) || ch === '۝',
    )
  ) {
    parts.pop();
    const digits = [...last]
      .filter(ch => ch !== '۝')
      .map(ch =>
        ARABIC_INDIC_DIGITS.includes(ch)
          ? String(ARABIC_INDIC_DIGITS.indexOf(ch))
          : ch,
      )
      .join('');
    number = digits ? Number(digits) : null;
  }
  return {words: parts, number};
}

/**
 * @typedef {object} ParsedWord
 * @property {string} text
 * @property {Cluster[]} clusters
 * @property {MarkToken[]} marks
 */

/**
 * @param {string} text
 * @param {string[]} log
 * @returns {{words: ParsedWord[], number: number|null}}
 */
function parseAyah(text, log) {
  const {words, number} = splitAyah(text);
  /** @type {ParsedWord[]} */
  const out = [];
  for (const w of words) {
    const {clusters, marks} = parseWord(w, log);
    if (clusters.length === 0) {
      // a mark standing alone (e.g. a waqf sign separated by a space) belongs to the previous word
      if (out.length) out[out.length - 1].marks.push(...marks);
      continue;
    }
    normalizeWord(clusters, log);
    out.push({text: w, clusters: clusters.filter(c => !c.dropKitabah), marks});
  }
  return {words: out, number};
}

/**
 * Kitabah: sign what is written (section II.D.1).
 * @param {string} text Uthmani text of one ayah (an ayah number at the end is read as the ayah end marker)
 * @returns {AyahOut}
 */
export function toKitabah(text) {
  /** @type {string[]} */
  const log = [];
  const {words, number} = parseAyah(text, log);
  return {
    number,
    words: words.map(w => ({
      text: w.text,
      marks: w.marks,
      signs: w.clusters.map(c => {
        // An iqlab nun is written without sukun and its small mim is not signed
        // (Kitabah example "mim ba'di", p. 39): signOf already gives exactly that.
        // A sifr letter is signed still, with no haraka (II.C row 15).
        const s = signOf(c);
        if (c.sifr) s.vowel = null;
        return s;
      }),
    })),
    log,
  };
}

const IZHAR = new Set(['hamza', 'alif', 'ha', 'ain', 'hha', 'ghain', 'kha']);
const IDGHAM = new Set(['ya', 'nun', 'mim', 'waw', 'lam', 'ra']);
const QALQALAH = new Set(['qaf', 'tta', 'ba', 'jim', 'dal']);
/** @type {Record<string, Vowel>} */
const TANWIN_BASE = {
  fathatain: 'fathah',
  kasratain: 'kasrah',
  dammatain: 'dammah',
};
/** @type {Record<string, Vowel>} */
const LONG = {
  fathah: 'fathahTegak',
  kasrah: 'kasrahTegak',
  dammah: 'dammahTerbalik',
};

/**
 * @typedef {object} TilawahOptions
 * @property {boolean} [startOfReading] the ayah is read from a fresh start (default true)
 * @property {boolean} [stopAtEnd] the reader stops at the end of the ayah (default true)
 */

/**
 * Tilawah: sign as recited (section II.D.2 and the Kitabah/Tilawah table, II.E).
 * @param {string} text
 * @param {TilawahOptions} [opts]
 * @returns {AyahOut}
 */
export function toTilawah(text, opts = {}) {
  const startOfReading = opts.startOfReading !== false;
  const stopAtEnd = opts.stopAtEnd !== false;
  /** @type {string[]} */
  const log = [];
  const {words, number} = parseAyah(text, log);

  /** @type {{text: string, marks: MarkToken[], items: {c: Cluster, s: SignToken|null}[]}[]} */
  const ws = words.map(w => ({
    text: w.text,
    marks: w.marks,
    items: w.clusters.map(c => ({c, s: signOf(c)})),
  }));

  const lastWordIndex = ws.length - 1;
  ws.forEach((w, wi) => {
    const next = ws[wi + 1];
    const nextStartsWithWasla = !!next && next.items[0]?.c.wasla;
    const isLastWord = wi === lastWordIndex;
    w.items.forEach((it, i) => {
      const c = it.c;
      const s = it.s;
      if (!s) return;
      const prevIt = [...w.items.slice(0, i)].reverse().find(x => x.s);
      // tanda sifr: not signed in Tilawah (II.C row 15)
      if (c.sifr) {
        it.s = null;
        return;
      }
      // alif wasla: pronounced only when reading starts on it (II.E row 3, Fatihah example)
      if (c.wasla) {
        if (wi === 0 && i === 0 && startOfReading) {
          if (!s.vowel) {
            const n1 = w.items[1]?.c;
            const n2 = w.items[2]?.c;
            if (
              n1 &&
              n1.letter === 'lam' &&
              !n1.shadda &&
              (n1.vowel === null || n1.vowel === 'sukun')
            )
              s.vowel = 'fathah';
            else if (
              n2 &&
              (n2.vowel === 'dammah' || n2.vowel === 'dammahTerbalik')
            )
              s.vowel = 'dammah';
            else s.vowel = 'kasrah';
            log.push(
              `${c.src}: alif wasla at the start of reading signed with ${s.vowel}`,
            );
          }
        } else {
          it.s = null;
        }
        return;
      }
      // lam of the article (and of Allah) assimilated into a shadda letter: not signed (II.E, alif lam syamsiyah)
      if (
        c.letter === 'lam' &&
        !c.vowel &&
        !c.shadda &&
        i > 0 &&
        w.items
          .slice(0, i)
          .some(x => x.c.wasla || (x.c.letter === 'alif' && !x.c.vowel)) &&
        w.items[i + 1]?.c.shadda
      ) {
        it.s = null;
        return;
      }
      // madd letters and carriers: not signed; the previous haraka is lengthened (II.D.2 "Ketentuan lainnya" 1)
      if (c.maddLetter || c.maddCarrier) {
        it.s = null;
        const shortened =
          !isLastWord && i === w.items.length - 1 && nextStartsWithWasla;
        if (prevIt && prevIt.s && !c.maddCarrier) {
          const v = prevIt.s.vowel;
          if (v && v in LONG && !prevIt.s.madd) {
            if (shortened)
              log.push(
                `${c.src}: long vowel shortened before alif wasla (two sukun meet)`,
              );
            else prevIt.s.vowel = LONG[v];
          }
        }
        return;
      }
      if (c.letter === 'hamza') s.letter = 'hamza_tilawah';
    });
  });

  // stop at the end of the ayah (waqf): last signed letter takes sukun
  if (stopAtEnd && ws.length) {
    const w = ws[lastWordIndex];
    const items = w.items;
    const lastAlif = items[items.length - 1];
    const live = items.filter(x => x.s);
    const last = live[live.length - 1];
    if (last && last.s) {
      if (last.c.vowel === 'fathatain' && lastAlif.c.maddLetter) {
        last.s.vowel = 'fathahTegak'; // mad iwad (II.E row 9)
      } else if (last.c.letter === 'ta_marbuta') {
        last.s.letter = 'ha';
        last.s.vowel = 'sukun';
      } else if (
        !last.c.maddLetter &&
        last.s.vowel &&
        !['fathahTegak', 'kasrahTegak', 'dammahTerbalik'].includes(last.s.vowel)
      ) {
        last.s.vowel = 'sukun';
      }
    }
  }

  // nun sakinah and tanwin (II.D.2 table, rows 2 to 5)
  /** @type {{wi: number, it: {c: Cluster, s: SignToken|null}}[]} */
  const flat = [];
  ws.forEach((w, wi) => w.items.forEach(it => it.s && flat.push({wi, it})));
  for (let k = 0; k < flat.length; k++) {
    const {wi, it} = flat[k];
    const s = /** @type {SignToken} */ (it.s);
    const nxt = flat[k + 1];
    if (!nxt) continue;
    const ns = /** @type {SignToken} */ (nxt.it.s);
    const nunSakinah =
      s.letter === 'nun' &&
      (s.vowel === 'sukun' || s.vowel === null) &&
      !s.shadda;
    const tanwin = !!s.vowel && s.vowel in TANWIN_BASE;
    if (!nunSakinah && !tanwin) continue;
    const across = nxt.wi !== wi;
    const nextLetter = ns.letter === 'hamza_tilawah' ? 'hamza' : ns.letter;
    if (IZHAR.has(nextLetter)) continue;
    if (IDGHAM.has(nextLetter) && across) {
      ns.shadda = true;
      if (nunSakinah) it.s = null;
      else s.vowel = TANWIN_BASE[/** @type {string} */ (s.vowel)];
      log.push(
        `${s.src} + ${ns.src}: idgham, merged into a shadda on the next letter`,
      );
      continue;
    }
    if (nextLetter === 'ba') {
      if (nunSakinah) {
        s.letter = 'mim';
        s.vowel = null;
        s.hold = true;
      } else {
        s.hold = true;
      }
      log.push(`${s.src} + ${ns.src}: iqlab, nun signed as mim held 2 beats`);
      continue;
    }
    if (!IDGHAM.has(nextLetter)) {
      s.hold = true;
      log.push(`${s.src} + ${ns.src}: ikhfa, held 2 beats`);
    }
  }

  // qalqalah letters with sukun (II.D.2 table, row 6)
  for (const w of ws)
    for (const it of w.items)
      if (it.s && QALQALAH.has(it.s.letter) && it.s.vowel === 'sukun')
        it.s.qalqalah = true;

  return {
    number,
    words: ws.map(w => ({
      text: w.text,
      marks: w.marks,
      signs: /** @type {SignToken[]} */ (w.items.map(x => x.s).filter(Boolean)),
    })),
    log,
  };
}

/**
 * Compact text form of a converted ayah, used by the tests:
 *   "ba:kasrah sin:sukun mim:kasrah | lam:fathahTegak+shadda ..."
 * Waqf marks follow their word in brackets.
 * @param {AyahOut} ayah
 * @returns {string}
 */
export function formatAyah(ayah) {
  return ayah.words
    .map(w => {
      const signs = w.signs.map(formatSign).join(' ');
      const marks = w.marks.map(m => `[${m.label}]`).join('');
      return marks ? `${signs} ${marks}` : signs;
    })
    .join(' | ');
}

/**
 * @param {SignToken} s
 * @returns {string}
 */
export function formatSign(s) {
  let out = s.letter;
  if (s.vowel) out += `:${s.vowel}`;
  if (s.shadda) out += '+shadda';
  if (s.madd) out += '+madd';
  if (s.sifr) out += '+sifr';
  if (s.hold) out += '+hold';
  if (s.qalqalah) out += '+qalqalah';
  return out;
}
