/**
 * Aligns tajweed rules from QPC-encoded text onto DigitalKhatt-encoded text.
 *
 * The QPC tajweed data and DK word database use different Unicode representations
 * for the same Arabic text. This service handles the known substitution patterns
 * so that tajweed color indices land on the correct DK characters.
 *
 * Known differences:
 *  - Sukun:     DK U+0652  <->  QPC U+06E1
 *  - Tatweel:   QPC inserts U+0640 before superscript alef U+0670; DK omits it
 *  - Fatha:     DK inserts U+064E before superscript alef U+0670; QPC omits it
 *  - Hamza above decomposition:  DK U+0627 + U+0654  <->  QPC U+0623
 *  - Hamza below decomposition:  DK U+0627 + U+0655  <->  QPC U+0625
 *  - ZWNJ:      QPC inserts U+200C; DK omits it
 *  - Small marks: DK U+06DF <-> QPC U+06E1 (small high rounded zero vs dotless head)
 */

interface TajweedSegment {
  text: string;
  rule: string | null;
}

/** 1:1 codepoint substitutions (DK char -> QPC char) */
const EQUIV: Map<number, number> = new Map([
  [0x0652, 0x06e1], // Sukun variants
  [0x06df, 0x06e1], // Small high rounded zero ≈ small high dotless head
]);

/** Characters QPC may insert that DK omits */
const QPC_SKIP = new Set([
  0x0640, // Tatweel
  0x200c, // ZWNJ
]);

/** Waqf (stop/pause) marks — should never receive any tajweed coloring */
const WAQF_MARKS = new Set([
  0x06d6, // ۖ Small high ligature sad with lam with alef maksura
  0x06d7, // ۗ Small high ligature qaf with lam with alef maksura
  0x06d8, // ۘ Small high meem initial form
  0x06d9, // ۙ Small high lam alef
  0x06da, // ۚ Small high jeem
  0x06db, // ۛ Small high three dots
]);

/** Heavy letters that receive tafkhim (emphatic pronunciation):
 *  خ ص ض غ ط ق ظ ر */
const TAFKHIM_LETTERS = new Set([
  0x062e, // خ
  0x0635, // ص
  0x0636, // ض
  0x063a, // غ
  0x0637, // ط
  0x0642, // ق
  0x0638, // ظ
  0x0631, // ر
]);

/**
 * Maps each DK character index to its tajweed rule (or leaves it unmapped).
 *
 * Walks both the DK string and flattened QPC segments in parallel, using
 * known equivalence patterns to stay in sync. Returns a Map<dkCharIdx, rule>.
 */
export function alignWordTajweed(
  dkText: string,
  segments: TajweedSegment[],
): Map<number, string> | null {
  // Flatten segments into per-character rule array
  const qpcChars: {cp: number; rule: string | null}[] = [];
  for (const seg of segments) {
    for (const ch of seg.text) {
      qpcChars.push({cp: ch.codePointAt(0)!, rule: seg.rule});
    }
  }

  const result = new Map<number, string>();
  const dkArr = [...dkText]; // spread to handle surrogate pairs correctly
  let di = 0; // DK index
  let qi = 0; // QPC index

  while (di < dkArr.length && qi < qpcChars.length) {
    const dkCp = dkArr[di].codePointAt(0)!;
    const qpcCp = qpcChars[qi].cp;

    // --- Waqf marks in DK text: skip without coloring ---
    if (WAQF_MARKS.has(dkCp)) {
      di++;
      continue;
    }

    // --- Exact match ---
    if (dkCp === qpcCp) {
      if (qpcChars[qi].rule) {
        result.set(di, qpcChars[qi].rule!);
      }
      di++;
      qi++;
      continue;
    }

    // --- 1:1 equivalent codepoints (e.g. sukun variants) ---
    if (EQUIV.get(dkCp) === qpcCp) {
      if (qpcChars[qi].rule) {
        result.set(di, qpcChars[qi].rule!);
      }
      di++;
      qi++;
      continue;
    }

    // --- QPC has extra char that DK omits (tatweel, ZWNJ) ---
    if (QPC_SKIP.has(qpcCp)) {
      qi++;
      continue;
    }

    // --- DK has extra fatha U+064E before superscript alef U+0670 ---
    if (
      dkCp === 0x064e &&
      di + 1 < dkArr.length &&
      dkArr[di + 1].codePointAt(0) === 0x0670
    ) {
      // Skip the extra fatha in DK — don't advance QPC
      di++;
      continue;
    }

    // --- Hamza above decomposition: DK U+0627 + U+0654 <-> QPC U+0623 ---
    if (
      dkCp === 0x0627 &&
      di + 1 < dkArr.length &&
      dkArr[di + 1].codePointAt(0) === 0x0654 &&
      qpcCp === 0x0623
    ) {
      if (qpcChars[qi].rule) {
        result.set(di, qpcChars[qi].rule!);
        result.set(di + 1, qpcChars[qi].rule!);
      }
      di += 2;
      qi++;
      continue;
    }

    // --- Hamza below decomposition: DK U+0627 + U+0655 <-> QPC U+0625 ---
    if (
      dkCp === 0x0627 &&
      di + 1 < dkArr.length &&
      dkArr[di + 1].codePointAt(0) === 0x0655 &&
      qpcCp === 0x0625
    ) {
      if (qpcChars[qi].rule) {
        result.set(di, qpcChars[qi].rule!);
        result.set(di + 1, qpcChars[qi].rule!);
      }
      di += 2;
      qi++;
      continue;
    }

    // --- Waw hamza decomposition: DK U+0648 + U+0654 <-> QPC U+0624 ---
    if (
      dkCp === 0x0648 &&
      di + 1 < dkArr.length &&
      dkArr[di + 1].codePointAt(0) === 0x0654 &&
      qpcCp === 0x0624
    ) {
      if (qpcChars[qi].rule) {
        result.set(di, qpcChars[qi].rule!);
        result.set(di + 1, qpcChars[qi].rule!);
      }
      di += 2;
      qi++;
      continue;
    }

    // --- Unknown mismatch: advance both to stay in sync ---
    di++;
    qi++;
  }

  // Tafkhim: mark heavy letters that don't already have a rule
  applyTafkhim(dkArr, result);

  // Final pass: strip any rules from waqf marks (safety net)
  for (let i = 0; i < dkArr.length; i++) {
    if (WAQF_MARKS.has(dkArr[i].codePointAt(0)!)) {
      result.delete(i);
    }
  }

  return result.size > 0 ? result : null;
}

/**
 * Detects tafkhim for a DK word that has no QPC tajweed data at all.
 * Returns a Map<dkCharIdx, 'tafkhim'> or null.
 */
export function detectWordTafkhim(dkText: string): Map<number, string> | null {
  const result = new Map<number, string>();
  const dkArr = [...dkText];
  applyTafkhim(dkArr, result);

  // Strip any rules from waqf marks
  for (let i = 0; i < dkArr.length; i++) {
    if (WAQF_MARKS.has(dkArr[i].codePointAt(0)!)) {
      result.delete(i);
    }
  }

  return result.size > 0 ? result : null;
}

/** Arabic combining marks (tashkeel) that should inherit the tafkhim color
 *  from the preceding base letter. */
const TASHKEEL = new Set([
  0x064b, // Fathatan
  0x064c, // Dammatan
  0x064d, // Kasratan
  0x064e, // Fatha
  0x064f, // Damma
  0x0650, // Kasra
  0x0651, // Shadda
  0x0652, // Sukun
  0x0653, // Maddah
  0x0654, // Hamza above
  0x0655, // Hamza below
  0x0670, // Superscript alef
  0x06e1, // Small high dotless head (sukun variant)
  0x06df, // Small high rounded zero
  0x06db, // Small high three dots
  0x08f0, // Open fathatan
  0x08f2, // Open kasratan
]);

/** Ra (ر) with kasra or kasratan is light (tarqeeq), not heavy. */
const RA = 0x0631;
const KASRA = 0x0650;
const KASRATAN = 0x064d;

/** Collect the tashkeel indices following position i. */
function getTashkeelRange(dkArr: string[], start: number): number {
  let j = start;
  while (j < dkArr.length && TASHKEEL.has(dkArr[j].codePointAt(0)!)) {
    j++;
  }
  return j; // exclusive end
}

/** Check if any tashkeel in range [start, end) is kasra or kasratan. */
function hasKasra(dkArr: string[], start: number, end: number): boolean {
  for (let k = start; k < end; k++) {
    const cp = dkArr[k].codePointAt(0)!;
    if (cp === KASRA || cp === KASRATAN) return true;
  }
  return false;
}

/** Scan for heavy letters and assign 'tafkhim' to the letter and its
 *  following tashkeel, overriding any existing rule.
 *  Ra with kasra/kasratan is excluded (tarqeeq).
 *  Waqf marks are never colored. */
function applyTafkhim(dkArr: string[], result: Map<number, string>): void {
  for (let i = 0; i < dkArr.length; i++) {
    const cp = dkArr[i].codePointAt(0)!;

    // Never color waqf marks — also remove any rule assigned during alignment
    if (WAQF_MARKS.has(cp)) {
      result.delete(i);
      continue;
    }

    if (TAFKHIM_LETTERS.has(cp)) {
      const tashkeelEnd = getTashkeelRange(dkArr, i + 1);

      // Skip ra when followed by kasra (light pronunciation)
      if (cp === RA && hasKasra(dkArr, i + 1, tashkeelEnd)) {
        continue;
      }

      result.set(i, 'tafkhim');
      for (let j = i + 1; j < tashkeelEnd; j++) {
        // Don't color waqf marks even as tashkeel of a heavy letter
        if (WAQF_MARKS.has(dkArr[j].codePointAt(0)!)) {
          result.delete(j);
        } else {
          result.set(j, 'tafkhim');
        }
      }
    }
  }
}
