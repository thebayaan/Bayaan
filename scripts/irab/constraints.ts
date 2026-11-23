/**
 * Hard grammatical constraints on the treebank's labels.
 *
 * Where a label breaks a rule that cannot bend, and MASAQ (analysed
 * independently) gives a reading that keeps the rule, MASAQ's reading is
 * taken. A label is never changed on one source's word alone:
 *
 * 1. The five verbs (الأفعال الخمسة): a written nun of raf' means the verb
 *    is marfu' (لَا تُظْلَمُونَ); a dropped nun means it is not.
 * 2. A mansub present verb needs a ناصب before it (أن، لن، كي، إذن، لام
 *    التعليل، فاء السببية، واو المعية، حتى، أو). Without one, it is marfu'
 *    (لَا يَخْفَىٰ).
 * 3. The dual and the sound masculine plural show their case in their
 *    letters: ـان / ـون are nominative, ـين / ـيْن are not (ٱثْنَيْنِ).
 * 4. A first- or second-person verb cannot have a noun as its فاعل: such a
 *    noun is the object or a vocative (كَيْفَ تُحْىِ ٱلْمَوْتَىٰ، رَبِّ).
 */
import {
  bare,
  MULHAQ_LEMMAS,
  MULHAQ_WORD,
  type Case,
  type TreebankToken,
} from './irabText';
import type {MasaqSegment} from './masaq';

export interface ConstraintFixes {
  fiveVerbs: string[];
  noNasib: string[];
  letterCase: string[];
  /** Also: an elided-ya vocative read as a فاعل/object (رَبِّ). */
  personSubject: string[];
}

const CASE_OF: Record<string, Case> = {
  NOMINATIVE: 'NOM',
  ACCUSATIVE: 'ACC',
  GENITIVE: 'GEN',
};

/** The case a role itself demands. */
const ROLE_CASE: Record<string, Case> = {
  Subj: 'NOM',
  Pass: 'NOM',
  Obj: 'ACC',
  Poss: 'GEN',
  gen: 'GEN',
};
/** MASAQ roles that map onto one treebank role. */
const MASAQ_REL: Record<string, string> = {
  AGNT: 'Subj',
  PASS_SUBJ: 'Pass',
  OBJ: 'Obj',
  GEN_CONS: 'Poss',
  PREP_OBJ: 'gen',
};

const FIVE_PGN = /^(3MP|2MP|3MD|3FD|2D|2MD|2FD|3D|2FS)$/;

function key(t: TreebankToken): string {
  return `${t.loc!.surah}:${t.loc!.ayah}:${t.loc!.word}`;
}

function pronPgn(t: TreebankToken): string {
  return /PRON:([123][MF]?[SDP])/.exec(t.features)?.[1] ?? t.pgn;
}

/** Letters only, with the dagger alif read as alif. */
function letters(text: string): string {
  return bare(text.replace(/ٰ/g, 'ا'));
}

/** True when a ناصب stands before the verb (within its two words before). */
function hasNasib(verb: TreebankToken, tokens: TreebankToken[]): boolean {
  if (!verb.loc) return true;
  const {surah, ayah, word} = verb.loc;
  return tokens.some(x => {
    if (!x.loc || x === verb) return false;
    if (x.loc.surah !== surah || x.loc.ayah !== ayah) return false;
    const before =
      x.loc.word < word ||
      (x.loc.word === word && x.loc.token < verb.loc!.token);
    if (!before || word - x.loc.word > 2) return false;
    if (['SUB', 'PRP', 'CAUS', 'COM'].includes(x.pos)) return true;
    if (x.pos === 'NEG' && x.lemma === 'lan') return true;
    if (x.pos === 'ANS' && x.lemma === '<i*FA') return true;
    if (x.lemma === 'Hat~aY`' || x.lemma === 'Hat~aY') return true;
    // أو / الفاء / الواو may hide an أن after them (حتى، أو، فاء السببية).
    if (x.pos === 'CONJ' && (x.lemma === '>aw' || /^[fw]:/.test(x.prefix)))
      return true;
    if (/^(f|w):(CAUS|COM)\+/.test(x.prefix)) return true;
    return false;
  });
}

export function applyConstraints(
  sentences: Map<number, TreebankToken[]>,
  masaqStem: (wordKey: string) => MasaqSegment | undefined,
): ConstraintFixes {
  const fixes: ConstraintFixes = {
    fiveVerbs: [],
    noNasib: [],
    letterCase: [],
    personSubject: [],
  };
  for (const tokens of sentences.values()) {
    const byId = new Map(tokens.map(t => [t.id, t]));
    for (const t of tokens) {
      if (!t.loc) continue;
      const k = key(t);
      const m = masaqStem(k);
      const mCase = m ? CASE_OF[m.caseMood] : undefined;

      // 1. The five verbs.
      if (t.pos === 'V' && t.aspect === 'IMPF') {
        const word = tokens.filter(x => x.loc && key(x) === k);
        const subj = word.find(
          x =>
            x.segment === 'SUFFIX' &&
            x.pos === 'PRON' &&
            FIVE_PGN.test(pronPgn(x)),
        );
        const emphatic = word.some(
          x => /EMPH/.test(x.suffix) || /EMPH/.test(x.features),
        );
        if (subj && !emphatic) {
          const nun = /ن$/.test(letters(subj.uthmani));
          if (nun && t.mood && t.mood !== 'IND') {
            fixes.fiveVerbs.push(`${k} ${t.mood}→IND`);
            t.mood = '';
          } else if (!nun && (!t.mood || t.mood === 'IND')) {
            const want =
              m?.caseMood === 'ACCUSATIVE'
                ? 'SUBJ'
                : m?.caseMood === 'JUSSIVE'
                  ? 'JUS'
                  : null;
            if (want) {
              fixes.fiveVerbs.push(`${k} IND→${want}`);
              t.mood = want;
            }
          }
          continue;
        }
        // 2. Mansub without a ناصب.
        if (
          t.mood === 'SUBJ' &&
          m?.caseMood === 'NOMINATIVE' &&
          !hasNasib(t, tokens)
        ) {
          fixes.noNasib.push(`${k} SUBJ→IND`);
          t.mood = '';
        }
        continue;
      }

      if (t.segment !== 'STEM' || !['N', 'ADJ', 'PN'].includes(t.pos)) continue;

      // 3. Case shown in the letters of the dual / sound masculine plural.
      const num = t.pgn.replace(/^[123]/, '');
      const b = letters(t.uthmani);
      let lettersSay: 'NOM' | 'NOT_NOM' | null = null;
      if (/D$/.test(num)) {
        if (/ان$/.test(b)) lettersSay = 'NOM';
        else if (/(ين|ي)$/.test(b)) lettersSay = 'NOT_NOM';
      } else if (
        /MP$/.test(num) &&
        (t.derived ||
          t.pos === 'ADJ' ||
          MULHAQ_LEMMAS.has(t.lemma) ||
          MULHAQ_WORD.test(b))
      ) {
        if (/ون$/.test(b)) lettersSay = 'NOM';
        else if (/ين$/.test(b)) lettersSay = 'NOT_NOM';
      }
      if (lettersSay && t.case && mCase) {
        const broken =
          (lettersSay === 'NOM' && t.case !== 'NOM') ||
          (lettersSay === 'NOT_NOM' && t.case === 'NOM');
        const masaqKeeps =
          (lettersSay === 'NOM' && mCase === 'NOM') ||
          (lettersSay === 'NOT_NOM' && mCase !== 'NOM');
        if (broken && masaqKeeps) {
          // The role must fit the new case: keep the treebank's role when it
          // takes no case of its own (توكيد، صفة، معطوف ...), else take
          // MASAQ's role with it; with neither, leave the word alone.
          const rel = t.rel.replace(/\s+/g, '');
          const own = ROLE_CASE[rel];
          const masaqRel = MASAQ_REL[m!.role];
          if (!own || own === mCase) {
            fixes.letterCase.push(`${k} ${t.case}→${mCase}`);
            t.case = mCase;
          } else if (masaqRel && ROLE_CASE[masaqRel] === mCase) {
            fixes.letterCase.push(`${k} ${rel}/${t.case}→${masaqRel}/${mCase}`);
            t.rel = masaqRel;
            t.case = mCase;
          }
        }
      }

      // 5. A word whose ياء المتكلم has dropped (رَبِّ) and that MASAQ reads
      //    as a vocative is the منادى of an elided يا.
      const word = tokens.filter(x => x.loc && key(x) === k);
      const elidedYa = word.some(
        x =>
          x.segment === 'SUFFIX' &&
          x.pos === 'PRON' &&
          pronPgn(x) === '1S' &&
          !letters(x.uthmani),
      );
      if (
        elidedYa &&
        m?.role === 'VOC' &&
        t.rel.replace(/\s+/g, '') !== 'voc'
      ) {
        fixes.personSubject.push(`${k} ${t.rel}→voc`);
        t.rel = 'voc';
        t.case = 'ACC';
        continue;
      }

      // 4. A noun cannot be the فاعل of a first/second-person verb.
      const head = byId.get(t.head);
      if (
        t.rel.replace(/\s+/g, '') === 'Subj' &&
        head?.pos === 'V' &&
        /^[12]/.test(head.pgn) &&
        m
      ) {
        if (m.role === 'OBJ' && mCase === 'ACC') {
          fixes.personSubject.push(`${k} Subj→Obj`);
          t.rel = 'Obj';
          t.case = 'ACC';
        } else if (m.role === 'VOC') {
          fixes.personSubject.push(`${k} Subj→voc`);
          t.rel = 'voc';
          t.case = 'ACC';
        }
      }
    }
  }
  return fixes;
}
