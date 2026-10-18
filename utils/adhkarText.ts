/**
 * Adhkar Arabic text markers (Hisn al-Muslim conventions in data/adhkar.json):
 *  - (( ... )) marks the words to say (the dhikr); text outside it is
 *    narration or instructions. A row without (( )) is dhikr throughout.
 *  - [ ... ] marks additions from other narrations.
 * The parser turns a row into ordered segments without the marks, so the
 * reader can mute the narration and copy/share can give clean dhikr text.
 */

export type AdhkarSegmentKind = 'dhikr' | 'narration' | 'addition';

export interface AdhkarSegment {
  kind: AdhkarSegmentKind;
  text: string;
  /** Index into the row's Quran ranges when this segment is a Quran passage
   *  (drawn with Digital Khatt), else null. */
  quranIndex: number | null;
}

/** A Quran passage inside a row: [start, end) offsets into the arabic text,
 *  including any ﴿ ﴾ around it. */
export interface AdhkarTextRange {
  start: number;
  end: number;
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LEADING_PUNCTUATION = /^[\s،,.:;؛\-–]+/;

function runLength(text: string, from: number, char: string): number {
  let end = from;
  while (end < text.length && text[end] === char) end += 1;
  return end - from;
}

// Drops brackets left without their partner inside one segment (a pair
// split by a (( )), [ ] or Quran boundary, or a ﴿ the data never closes).
function withoutUnpaired(
  text: string,
  openChar: string,
  closeChar: string,
): string {
  const open: number[] = [];
  const drop = new Set<number>();
  for (let i = 0; i < text.length; i++) {
    if (text[i] === openChar) open.push(i);
    if (text[i] === closeChar) {
      const match = open.pop();
      if (match === undefined) drop.add(i);
    }
  }
  for (const i of open) drop.add(i);
  if (drop.size === 0) return text;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (!drop.has(i)) out += text[i];
  }
  return out;
}

// Narration drops its ( ) pairs too: they wrap an instruction or a count
// ("(يَبْدَأُ بِرِجْلِهِ الْيُمْنَى)، وَيَقُولُ:"), which the muted style
// already sets apart.
function cleanSegmentText(raw: string, kind: AdhkarSegmentKind): string {
  const paired = withoutUnpaired(withoutUnpaired(raw, '(', ')'), '﴿', '﴾');
  const text = (kind === 'narration' ? paired.replace(/[()]/g, ' ') : paired)
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\.?\s*/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(LEADING_PUNCTUATION, '')
    .replace(/\s+([،,.:;؛])/g, '$1')
    .trim();
  return LETTER_OR_DIGIT.test(text) ? text : '';
}

// Offsets of a single "( ... )" pair that wraps the whole text (a "." may
// follow it), the way rows without (( )) mark their dhikr; else none.
function outerParenPair(text: string): number[] {
  const start = text.search(/\S/);
  if (start < 0 || text[start] !== '(') return [];
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return /^\s*\.?\s*$/.test(text.slice(i + 1)) ? [start, i] : [];
      }
    }
  }
  return [];
}

/**
 * Ordered segments of an adhkar Arabic text, marks removed.
 *
 * Odd cases in the data: a run of three parentheses is a single parenthesis
 * next to the mark (")))" closes "(ثلاثاً)" and the dhikr); a "((" inside an
 * open dhikr starts a new dhikr, and the text before it becomes narration
 * when it introduces speech (ends with ":"); a "))" with no open dhikr and an
 * unmatched "]" are dropped.
 *
 * `quranRanges` (sorted, non-overlapping) are emitted as their own segments
 * with `quranIndex` set and the ﴿ ﴾ removed from their text.
 */
export function parseAdhkarArabic(
  arabic: string,
  quranRanges: readonly AdhkarTextRange[] = [],
): AdhkarSegment[] {
  const hasDhikrMarks = arabic.includes('((');
  const skipped = new Set(hasDhikrMarks ? [] : outerParenPair(arabic));
  const segments: AdhkarSegment[] = [];
  let buffer = '';
  let inDhikr = false;
  let inAddition = false;
  let nextRange = 0;

  function currentKind(): AdhkarSegmentKind {
    if (inAddition) return 'addition';
    return inDhikr || !hasDhikrMarks ? 'dhikr' : 'narration';
  }

  function push(
    kind: AdhkarSegmentKind,
    raw: string,
    quranIndex: number | null,
  ): void {
    const text = cleanSegmentText(raw, kind);
    if (text) segments.push({kind, text, quranIndex});
  }

  function flush(kind: AdhkarSegmentKind = currentKind()): void {
    push(kind, buffer, null);
    buffer = '';
  }

  let i = 0;
  while (i < arabic.length) {
    const range = quranRanges[nextRange];
    if (range && i >= range.start) {
      flush();
      const passage = arabic.slice(range.start, range.end).replace(/[﴿﴾]/g, '');
      push(currentKind(), passage, nextRange);
      i = Math.max(i, range.end);
      nextRange += 1;
      continue;
    }

    const char = arabic[i];
    if (skipped.has(i)) {
      i += 1;
      continue;
    }
    if (char === '(' && arabic[i + 1] === '(') {
      const run = runLength(arabic, i, '(');
      if (inDhikr) {
        flush(/:\s*$/.test(buffer) ? 'narration' : 'dhikr');
      } else {
        flush();
      }
      inDhikr = true;
      // Extra parentheses after the mark belong to the text.
      buffer += '('.repeat(run - 2);
      i += run;
      continue;
    }
    if (char === ')' && arabic[i + 1] === ')') {
      const run = runLength(arabic, i, ')');
      // Extra parentheses before the mark belong to the text.
      buffer += ')'.repeat(run - 2);
      if (inDhikr) {
        flush();
        inDhikr = false;
      }
      i += run;
      continue;
    }
    if (char === '[') {
      flush();
      inAddition = true;
      i += 1;
      continue;
    }
    if (char === ']') {
      if (inAddition) {
        flush();
        inAddition = false;
      }
      i += 1;
      continue;
    }
    buffer += char;
    i += 1;
  }
  flush();
  return segments;
}

/**
 * Clean Arabic for copy and share: the dhikr (additions included) without
 * marks. Transliterations carry the same marks and use it too. When the row is mostly narration (a hadith with a short dhikr
 * inside), the whole text is kept, in order, so it still reads.
 */
export function adhkarCopyText(arabic: string): string {
  const segments = parseAdhkarArabic(arabic);
  let narration = 0;
  let total = 0;
  for (const segment of segments) {
    total += segment.text.length;
    if (segment.kind === 'narration') narration += segment.text.length;
  }
  const kept =
    narration * 2 > total
      ? segments
      : segments.filter(segment => segment.kind !== 'narration');
  return kept.map(segment => segment.text).join(' ');
}

/**
 * English translations reuse (( )) only rarely as a mark; most "))" there
 * close two nested parentheses. Collapse just the self-contained ((x)) pairs
 * to (x), which keeps every other parenthesis balanced.
 */
export function cleanAdhkarTranslation(translation: string): string {
  return translation.replace(/\(\(([^()]*)\)\)/g, '($1)');
}

/**
 * English translation conventions (hisnmuslim.com English): the dhikr is
 * wrapped in ( ), mirroring the Arabic (( )); text outside it, count notes and
 * separated definitions are narration. Short glosses inside a sentence
 * ("(or)", "(i.e. the garment)") are the translator's additions and keep
 * their parentheses. Ayah numbers "( 190 )" and "[Soorah ... (112)]" labels
 * become references.
 */
export type AdhkarTranslationKind = 'dhikr' | 'narration' | 'reference';

export interface AdhkarTranslationSegment {
  kind: AdhkarTranslationKind;
  text: string;
}

type TranslationNode =
  | {type: 'text'; text: string}
  | {type: 'label'; text: string}
  | {type: 'group'; children: TranslationNode[]};

type GroupRole =
  | 'reference'
  | 'count'
  | 'inline'
  | 'gloss'
  | 'quote'
  | 'dhikr'
  | 'narration';

const TRANSLATION_TOKEN = /\[Soorah[^\]]*\]|[()]|[^()[]+|\[/gi;
const COUNT_NOTE = /\b(times?|once|twice|thrice)\b/i;
const MAX_COUNT_NOTE = 60;
const HONORIFIC =
  /^(ﷺ|PBUH|sal-Allaahu\b.*|radhi-yAllaahu\b.*|or prayers of peace)$/i;
// "shirk: ...", "Meaning of Al-Muqaddim and Al-Mu-akhkhir: ...", "Say:".
const DEFINITION = /^[^\s,.:;()]+(?:[ -][^\s,.:;()]+){0,5}\s*:/;
// "He also said: ‘...", "othman Ibn Al-AAas narrated: ..." open a hadith.
const SPEECH_HEAD =
  /^[^:]*\b(said|says|say|narrated|reported|related|replied)\s*:/i;
const NARRATION_START = /^(This supplication|e\.g\.|i\.e\.|…)/i;
const DHIKR_START =
  /^['‘’"]?(O Allah|O our Lord|I take refuge|I seek refuge|None has the right|How perfect|All praise|In the name of Allah)\b/i;
const INTRODUCES_SPEECH = /:\s*['‘’"]*\s*$/;
const ENDS_SENTENCE = /[.!?…]['‘’"]*\s*$/;
const STARTS_WORD = /^\s*[A-Za-z]/;
// A gloss follows a word or a comma: "replace it (with another)".
const AFTER_WORD = /[\p{L}\p{N},]\s*$/u;
const MAX_SPOKEN_GLOSS = 20;

function parseTranslationTree(text: string): TranslationNode[] {
  const root: TranslationNode[] = [];
  const stack: TranslationNode[][] = [root];
  for (const [token] of text.matchAll(TRANSLATION_TOKEN)) {
    const children = stack[stack.length - 1];
    if (token === '(') {
      const group: TranslationNode = {type: 'group', children: []};
      children.push(group);
      stack.push(group.children);
    } else if (token === ')') {
      // An unpaired ")" is dropped.
      if (stack.length > 1) stack.pop();
    } else if (/^\[Soorah/i.test(token)) {
      children.push({type: 'label', text: token});
    } else {
      children.push({type: 'text', text: token});
    }
  }
  // An unclosed "(" is dropped and its content stays in place.
  while (stack.length > 1) {
    const open = stack.pop() ?? [];
    const parent = stack[stack.length - 1];
    const group = parent.pop();
    if (group?.type === 'group') parent.push(...open);
  }
  return root;
}

// "[Soorah al-Ikhlaas (112)]" -> "Soorah al-Ikhlaas 112".
function labelText(label: string): string {
  return label
    .replace(/[[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flatText(nodes: readonly TranslationNode[]): string {
  return nodes
    .map(node => {
      if (node.type === 'text') return node.text;
      if (node.type === 'label') return labelText(node.text);
      return `(${flatText(node.children)})`;
    })
    .join('');
}

function ownText(nodes: readonly TranslationNode[]): string {
  return nodes.map(node => (node.type === 'text' ? node.text : ' ')).join('');
}

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isNarrationLike(inner: string): boolean {
  return (
    (DEFINITION.test(inner) && !SPEECH_HEAD.test(inner)) ||
    NARRATION_START.test(inner) ||
    /:$/.test(inner)
  );
}

interface Neighbours {
  /** Text since the previous group (or the start), without groups. */
  before: string;
  /** Role of the previous group when only whitespace separates it. */
  previousRole: GroupRole | null;
  /** Text up to the next group. */
  after: string;
  atStart: boolean;
}

function neighbours(
  nodes: readonly TranslationNode[],
  index: number,
  roles: ReadonlyMap<number, GroupRole>,
): Neighbours {
  let before = '';
  let previousRole: GroupRole | null = null;
  let atStart = true;
  for (let i = index - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.type === 'group') {
      atStart = false;
      if (before.trim() === '') previousRole = roles.get(i) ?? null;
      break;
    }
    before = (node.type === 'text' ? node.text : labelText(node.text)) + before;
  }
  if (before.trim() !== '') atStart = false;
  let after = '';
  for (let i = index + 1; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'group') break;
    after += node.type === 'text' ? node.text : labelText(node.text);
  }
  return {before, previousRole, after, atStart};
}

function groupRole(
  group: readonly TranslationNode[],
  around: Neighbours,
  parentKind: 'dhikr' | 'narration',
  topLevel: boolean,
): GroupRole {
  const inner = tidy(flatText(group));
  if (/^\d+$/.test(inner)) return 'reference';
  const onlyLabels =
    group.some(node => node.type === 'label') &&
    group.every(
      node =>
        node.type === 'label' || (node.type === 'text' && !node.text.trim()),
    );
  if (onlyLabels) return 'reference';
  if (HONORIFIC.test(inner)) return 'inline';
  if (COUNT_NOTE.test(ownText(group)) && inner.length <= MAX_COUNT_NOTE) {
    return 'count';
  }
  // A group opening with a surah label is the surah (row 76).
  if (
    group.find(node => node.type !== 'text' || node.text.trim())?.type ===
    'label'
  ) {
    return 'dhikr';
  }
  if (INTRODUCES_SPEECH.test(around.before)) {
    // "said:’(There are) Two words" is a gloss, not the words said.
    const gloss =
      inner.length <= MAX_SPOKEN_GLOSS &&
      STARTS_WORD.test(around.after) &&
      !ENDS_SENTENCE.test(inner);
    return gloss ? 'gloss' : 'quote';
  }
  if (around.atStart) {
    if (isNarrationLike(inner)) return 'narration';
    if (topLevel) return 'dhikr';
    // A group opening a dhikr is part of it ("((In the name of Allah). O
    // Allah, ..."); one opening a note is a gloss ("(al) has been ...").
    return parentKind === 'dhikr' ? 'inline' : 'gloss';
  }
  if (around.previousRole === null && AFTER_WORD.test(around.before)) {
    return 'gloss';
  }
  if (isNarrationLike(inner)) return 'narration';
  if (around.previousRole === 'quote') return 'quote';
  return DHIKR_START.test(inner) ? 'dhikr' : 'narration';
}

function hasDhikr(
  nodes: readonly TranslationNode[],
  parentKind: 'dhikr' | 'narration' = 'dhikr',
  topLevel = true,
): boolean {
  const roles = new Map<number, GroupRole>();
  return nodes.some((node, index) => {
    if (node.type !== 'group') return false;
    const role = groupRole(
      node.children,
      neighbours(nodes, index, roles),
      parentKind,
      topLevel,
    );
    roles.set(index, role);
    if (role === 'dhikr' || role === 'quote') return true;
    return role === 'narration' && hasDhikr(node.children, 'narration', false);
  });
}

type RunPiece = {reference: boolean; text: string};

function segmentNodes(
  nodes: readonly TranslationNode[],
  kind: 'dhikr' | 'narration',
  topLevel: boolean,
  out: AdhkarTranslationSegment[],
): void {
  const roles = new Map<number, GroupRole>();
  let run: RunPiece[] = [];
  let afterQuote = false;

  function flush(): void {
    const text = run
      .filter(piece => !piece.reference)
      .map(piece => piece.text)
      .join('');
    let runKind = kind;
    // Quran verses with ayah numbers are recited even outside a wrapper
    // (row 76: Soorah an-Naas follows its label's closed parenthesis).
    if (topLevel && run.some(piece => piece.reference)) {
      runKind = 'dhikr';
    } else if (afterQuote || INTRODUCES_SPEECH.test(text)) {
      // The words before and after a quoted dhikr narrate it.
      runKind = 'narration';
    }
    let buffer = '';
    for (const piece of run) {
      if (!piece.reference) {
        buffer += piece.text;
        continue;
      }
      out.push({kind: runKind, text: buffer});
      out.push({kind: 'reference', text: piece.text});
      buffer = '';
    }
    out.push({kind: runKind, text: buffer});
    run = [];
  }

  nodes.forEach((node, index) => {
    if (node.type === 'text') {
      run.push({reference: false, text: node.text});
      return;
    }
    if (node.type === 'label') {
      run.push({reference: true, text: labelText(node.text)});
      return;
    }
    const role = groupRole(
      node.children,
      neighbours(nodes, index, roles),
      kind,
      topLevel,
    );
    roles.set(index, role);
    const inner = tidy(flatText(node.children));
    switch (role) {
      case 'reference':
        run.push({reference: true, text: inner});
        return;
      case 'inline':
        run.push({reference: false, text: inner});
        return;
      case 'gloss':
        run.push({reference: false, text: `(${inner})`});
        return;
      case 'count':
        flush();
        out.push({kind: 'narration', text: inner.replace(/[[\]()]/g, ' ')});
        return;
      case 'quote':
        flush();
        segmentNodes(node.children, 'dhikr', false, out);
        afterQuote = true;
        return;
      case 'dhikr':
      case 'narration':
        flush();
        segmentNodes(node.children, role, false, out);
        return;
    }
  });
  flush();
}

/**
 * Ordered segments of an adhkar English translation, the dhikr wrapper,
 * count and footnote parentheses removed. Text outside the dhikr is
 * narration; a row without a wrapped dhikr is dhikr throughout.
 */
export function segmentAdhkarTranslation(
  translation: string,
): AdhkarTranslationSegment[] {
  const tree = parseTranslationTree(cleanAdhkarTranslation(translation));
  const raw: AdhkarTranslationSegment[] = [];
  segmentNodes(tree, hasDhikr(tree) ? 'narration' : 'dhikr', true, raw);
  const segments: AdhkarTranslationSegment[] = [];
  for (const segment of raw) {
    const text = tidy(segment.text)
      .replace(/^[\s,.;:]+/, '')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')');
    if (!LETTER_OR_DIGIT.test(text)) continue;
    const last = segments[segments.length - 1];
    if (last && last.kind === segment.kind && segment.kind !== 'reference') {
      last.text = `${last.text} ${text}`;
    } else {
      segments.push({kind: segment.kind, text});
    }
  }
  return segments;
}

/**
 * Clean translation for copy and share, with the same narration rule as
 * adhkarCopyText. References (ayah numbers, surah labels) are left out.
 */
export function adhkarTranslationCopyText(translation: string): string {
  const segments = segmentAdhkarTranslation(translation).filter(
    segment => segment.kind !== 'reference',
  );
  let narration = 0;
  let total = 0;
  for (const segment of segments) {
    total += segment.text.length;
    if (segment.kind === 'narration') narration += segment.text.length;
  }
  const kept =
    narration * 2 > total
      ? segments
      : segments.filter(segment => segment.kind !== 'narration');
  return kept.map(segment => segment.text).join(' ');
}

/**
 * Screen reader label for a list card: the clean Arabic dhikr (same narration
 * rules as copy, without the ornate brackets and * separators that a screen
 * reader would speak), then the translation when there is one.
 */
export function adhkarCardLabel(
  arabic: string,
  translation: string | null | undefined,
): string {
  const spoken = adhkarCopyText(arabic)
    .replace(/[\uFD3E\uFD3F*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!translation) return spoken;
  const english = segmentAdhkarTranslation(translation)
    .filter(segment => segment.kind !== 'reference')
    .map(segment => segment.text)
    .join(' ');
  return `${spoken}. ${english}`;
}
