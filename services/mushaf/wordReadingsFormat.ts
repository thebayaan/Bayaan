// @ai-generated
/**
 * Per-word readings index (data/mushaf/digitalkhatt/dk_readings.db), format 1:
 * the pure decoder. It checks every invariant of a row and throws
 * ReadingsFormatError on the first one it breaks, so a damaged or foreign row
 * is never shown as a reading of the Quran. Written by
 * scripts/rewayah/build_readings_index.py, whose gates hold the same rules
 * against the words DBs and highlight maps.
 *
 * Schema:
 *   info  (key TEXT PRIMARY KEY, value TEXT)   format = '1',
 *         rewayat = READINGS_REWAYAT joined by ',' (the member order),
 *         inputs = JSON {file name: sha256} of the DBs and diffs it was built from
 *   slots (verse_key TEXT, position INTEGER, word_id INTEGER, data TEXT,
 *          PRIMARY KEY (verse_key, position))
 * One row per Hafs content slot with something to show; a slot with no row
 * reads the same way in all 8 rewayat at word level.
 *
 * Row JSON (`member` = index into READINGS_REWAYAT, 0 = Hafs):
 *   t: string[]              stored span texts; t[0] is Hafs's; '' only for 'o'
 *   g: [kind, text, members][]  'h' (as Hafs, first, holds 0), 'd' (differs),
 *                            'o' (not read, last); every member exactly once
 *   m?: {member: {x?, s?, v?, w?, q?}}
 *        x own text (index into t), s silah char indices into it (UTF-16),
 *        v its own verse number where it ends a verse after the word and Hafs
 *        does not, 0 where Hafs ends one and it does not, w its word count
 *        ('h' members writing the span as more or fewer words), q 1 for a
 *        suspected KFGQPC misprint read with its sibling narrator (never shown)
 *   span?: [firstWordId, lastWordId]  two Hafs slots read as one span
 *   u?: member[]             1:1 only: members that do not number the basmala
 */
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

export const READINGS_FORMAT = 1;

/** Member order of the index (the first 8 of ALL_REWAYAH_IDS). */
export const READINGS_REWAYAT = [
  'hafs',
  'shubah',
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
] as const;

export type ReadingsRewayah = (typeof READINGS_REWAYAT)[number];

/** The whole-word category each rewayah's diff file uses: close → major,
 *  far → mukhtalif (RewayahDiffService). */
export const WHOLE_WORD_CATEGORY: Readonly<
  Record<Exclude<ReadingsRewayah, 'hafs'>, 'major' | 'mukhtalif'>
> = {
  shubah: 'major',
  'al-bazzi': 'major',
  qunbul: 'major',
  warsh: 'mukhtalif',
  qalun: 'mukhtalif',
  'al-duri-abi-amr': 'mukhtalif',
  'al-susi': 'mukhtalif',
};

export type ReadingGroupKind = 'asHafs' | 'differs' | 'notRead';

export interface ReadingMember {
  readonly rewayah: ReadingsRewayah;
  /** Its exact stored text, when shown under its group: a differing member
   *  whose text is not the group's, or any member with silah. */
  readonly ownText: string | null;
  /** The diff category of a member of a 'differs' group, else null. */
  readonly category: 'major' | 'mukhtalif' | null;
  /** Silah char indices (UTF-16) into ownText. */
  readonly silahChars: readonly number[];
  /** Its own verse number where it ends a verse after the word and Hafs does
   *  not; 0 where Hafs ends one and it does not; null: as Hafs. */
  readonly verseEnd: number | null;
  /** The number of words it writes the span as, when not Hafs's (asHafs). */
  readonly wordCount: number | null;
  /** A suspected KFGQPC misprint read with its sibling narrator. Data only:
   *  the app shows no note (plan README, Readings). */
  readonly questioned: boolean;
}

export interface ReadingGroup {
  readonly kind: ReadingGroupKind;
  /** Hafs's text ('asHafs'), the first member's stored text ('differs'),
   *  '' ('notRead'). */
  readonly text: string;
  readonly members: readonly ReadingMember[];
}

export interface WordReadings {
  /** Hafs verse key. */
  readonly verseKey: string;
  /** The Hafs DK positions the readings cover (two for a span). */
  readonly positions: readonly number[];
  /** The asHafs group's text; null for a word with no row. */
  readonly hafsText: string | null;
  /** asHafs first, then the differing readings, then notRead. */
  readonly groups: readonly ReadingGroup[];
  /** One group and nothing to note: read the same way in all 8 rewayat. */
  readonly alike: boolean;
  /** al-Fatiha's basmala is not numbered in these (1:1 only). */
  readonly basmalaUnnumberedIn: readonly ReadingsRewayah[];
}

export class ReadingsFormatError extends Error {
  readonly location: string;

  constructor(location: string, message: string) {
    super(`[WordReadings] ${location}: ${message}`);
    this.name = 'ReadingsFormatError';
    this.location = location;
    Object.setPrototypeOf(this, ReadingsFormatError.prototype);
  }
}

export interface ReadingsInfo {
  readonly format: number;
  readonly rewayat: readonly string[];
  readonly inputs: Readonly<Record<string, string>>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIndex = (value: unknown, length: number): value is number =>
  Number.isInteger(value) &&
  (value as number) >= 0 &&
  (value as number) < length;

/** The info table: format, member order and input hashes. */
export function parseReadingsInfo(
  rows: readonly {key: string; value: string}[],
): ReadingsInfo {
  const values = new Map(rows.map(row => [row.key, row.value]));
  const format = Number(values.get('format'));
  const rewayat = values.get('rewayat');
  const rawInputs = values.get('inputs');
  if (!Number.isInteger(format) || typeof rewayat !== 'string') {
    throw new ReadingsFormatError('info', 'format or rewayat missing');
  }
  let inputs: unknown;
  try {
    inputs = JSON.parse(rawInputs ?? '');
  } catch {
    throw new ReadingsFormatError('info', 'inputs is not JSON');
  }
  if (
    !isObject(inputs) ||
    !Object.values(inputs).every(v => typeof v === 'string')
  ) {
    throw new ReadingsFormatError('info', 'inputs is not a map of hashes');
  }
  return {
    format,
    rewayat: rewayat.split(','),
    inputs: inputs as Record<string, string>,
  };
}

const KINDS: Readonly<Record<string, ReadingGroupKind>> = {
  h: 'asHafs',
  d: 'differs',
  o: 'notRead',
};
const KIND_ORDER = 'hdo';
const DETAIL_KEYS = new Set(['x', 's', 'v', 'w', 'q']);
const SILAH_MARKS = new Set(['\u06E5', '\u06E6']);
const SILAH_CARRIERS = new Set(['\u064F', '\u0650']);

function isSilahChar(text: string, i: number): boolean {
  const c = text[i];
  return (
    SILAH_MARKS.has(c) ||
    (SILAH_CARRIERS.has(c) && SILAH_MARKS.has(text[i + 1] ?? ''))
  );
}

/**
 * Decodes one slots row (Hafs `verseKey`, DK `position`, `wordId`), checking
 * every invariant of the format. Throws ReadingsFormatError on any breach.
 */
export function decodeReadingsRow(
  verseKey: string,
  position: number,
  wordId: number,
  data: string,
): WordReadings {
  const where = `${verseKey}:${position}`;
  const fail = (message: string): never => {
    throw new ReadingsFormatError(where, message);
  };
  let row: unknown;
  try {
    row = JSON.parse(data);
  } catch {
    return fail('row is not JSON');
  }
  if (!isObject(row)) return fail('row is not an object');
  for (const key of Object.keys(row)) {
    if (!['t', 'g', 'm', 'span', 'u'].includes(key)) {
      fail(`unknown key "${key}"`);
    }
  }
  const {t, g} = row;
  if (
    !Array.isArray(t) ||
    t.length === 0 ||
    !t.every(text => typeof text === 'string')
  ) {
    return fail('t is not a list of texts');
  }
  const texts = t as string[];
  if (new Set(texts).size !== texts.length) fail('duplicate texts');
  if (!Array.isArray(g) || g.length === 0) return fail('no groups');

  const memberCount = READINGS_REWAYAT.length;
  const seen = new Set<number>();
  const kindOf = new Map<number, string>();
  const referenced = new Set<number>();
  let previousKind = -1;
  const parsedGroups = g.map((group, gi) => {
    if (!Array.isArray(group) || group.length !== 3) {
      return fail(`group ${gi} is malformed`);
    }
    const [kind, textIndex, members] = group as [unknown, unknown, unknown];
    if (typeof kind !== 'string' || !(kind in KINDS)) {
      return fail(`group ${gi} has an unknown kind`);
    }
    const order = KIND_ORDER.indexOf(kind);
    if (order < previousKind || (order === previousKind && kind !== 'd')) {
      fail(`group ${gi} is out of order`);
    }
    previousKind = order;
    if (!isIndex(textIndex, texts.length)) {
      return fail(`group ${gi} text index out of range`);
    }
    referenced.add(textIndex);
    if (
      !Array.isArray(members) ||
      members.length === 0 ||
      !members.every(x => isIndex(x, memberCount))
    ) {
      return fail(`group ${gi} has a bad member list`);
    }
    const list = members as number[];
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && list[i] <= list[i - 1]) fail(`group ${gi} is not sorted`);
      if (seen.has(list[i])) fail(`member ${list[i]} is in two groups`);
      seen.add(list[i]);
      kindOf.set(list[i], kind);
    }
    const text = texts[textIndex];
    if ((kind === 'o') !== (text === '')) {
      fail(`group ${gi}: only a not-read group has no text`);
    }
    return {kind, textIndex, members: list};
  });
  if (seen.size !== memberCount) fail('a member is in no group');
  if (parsedGroups[0].kind !== 'h' || !parsedGroups[0].members.includes(0)) {
    fail("the first group is not Hafs's");
  }
  if (parsedGroups[0].textIndex !== 0) fail("t[0] is not Hafs's text");

  const details = row.m ?? {};
  if (!isObject(details)) return fail('m is not an object');
  const decodedDetails = new Map<
    number,
    {x?: number; s?: number[]; v?: number; w?: number; q?: 1}
  >();
  for (const [key, value] of Object.entries(details)) {
    const member = Number(key);
    if (
      !isIndex(member, memberCount) ||
      member === 0 ||
      String(member) !== key
    ) {
      fail(`m has a bad member key "${key}"`);
    }
    if (!isObject(value) || Object.keys(value).length === 0) {
      fail(`m.${key} is empty`);
    }
    const d = value as Record<string, unknown>;
    for (const k of Object.keys(d)) {
      if (!DETAIL_KEYS.has(k)) fail(`m.${key} has an unknown detail "${k}"`);
    }
    const kind = kindOf.get(member);
    const out: {x?: number; s?: number[]; v?: number; w?: number; q?: 1} = {};
    if (d.x !== undefined) {
      if (!isIndex(d.x, texts.length) || texts[d.x] === '') {
        fail(`m.${key}.x out of range`);
      }
      if (kind === 'o') fail(`m.${key}: own text on a word not read`);
      out.x = d.x as number;
      referenced.add(out.x);
    }
    if (d.s !== undefined) {
      if (out.x === undefined) fail(`m.${key}: silah without its own text`);
      const own = texts[out.x as number];
      if (
        !Array.isArray(d.s) ||
        d.s.length === 0 ||
        !d.s.every(
          (c, i, all) =>
            isIndex(c, own.length) &&
            (i === 0 || c > (all[i - 1] as number)) &&
            isSilahChar(own, c as number),
        )
      ) {
        fail(`m.${key}: silah index out of range or not on a silah mark`);
      }
      out.s = d.s as number[];
    }
    if (out.x !== undefined && out.s === undefined && kind !== 'd') {
      fail(`m.${key}: own text without silah outside a differing reading`);
    }
    if (d.v !== undefined) {
      if (!Number.isInteger(d.v) || (d.v as number) < 0) {
        fail(`m.${key}.v is not a verse number`);
      }
      out.v = d.v as number;
    }
    if (d.w !== undefined) {
      if (!Number.isInteger(d.w) || (d.w as number) < 1 || kind !== 'h') {
        fail(`m.${key}.w is not a word count of an as-Hafs member`);
      }
      out.w = d.w as number;
    }
    if (d.q !== undefined) {
      if (d.q !== 1 || out.x !== undefined || kind === 'o') {
        fail(`m.${key}.q is malformed`);
      }
      out.q = 1;
    }
    decodedDetails.set(member, out);
  }
  if (referenced.size !== texts.length) fail('a text is never used');

  let positions = [position];
  if (row.span !== undefined) {
    const span = row.span;
    if (
      !Array.isArray(span) ||
      span.length !== 2 ||
      !span.every(Number.isInteger) ||
      span[1] !== span[0] + 1 ||
      (wordId !== span[0] && wordId !== span[1])
    ) {
      return fail('span is malformed');
    }
    positions =
      wordId === span[0] ? [position, position + 1] : [position - 1, position];
    if (positions[0] < 1) fail('span starts before the verse');
  }

  let basmala: ReadingsRewayah[] = [];
  if (row.u !== undefined) {
    const u = row.u;
    if (
      verseKey !== '1:1' ||
      !Array.isArray(u) ||
      u.length === 0 ||
      !u.every(
        (x, i) =>
          isIndex(x, memberCount) &&
          x !== 0 &&
          (i === 0 || x > (u[i - 1] as number)),
      )
    ) {
      return fail('u is malformed');
    }
    basmala = (u as number[]).map(x => READINGS_REWAYAT[x]);
  }

  const groups: ReadingGroup[] = parsedGroups.map(group => {
    const kind = KINDS[group.kind];
    return {
      kind,
      text: texts[group.textIndex],
      members: group.members.map(index => {
        const rewayah = READINGS_REWAYAT[index];
        const d = decodedDetails.get(index) ?? {};
        return {
          rewayah,
          ownText: d.x !== undefined ? texts[d.x] : null,
          category:
            kind === 'differs' && rewayah !== 'hafs'
              ? WHOLE_WORD_CATEGORY[rewayah]
              : null,
          silahChars: d.s ?? [],
          verseEnd: d.v ?? null,
          wordCount: d.w ?? null,
          questioned: d.q === 1,
        };
      }),
    };
  });
  return {
    verseKey,
    positions,
    hafsText: texts[0],
    groups,
    alike: isAlike(groups, basmala),
    basmalaUnnumberedIn: basmala,
  };
}

function isAlike(
  groups: readonly ReadingGroup[],
  basmala: readonly ReadingsRewayah[],
): boolean {
  return (
    groups.length === 1 &&
    basmala.length === 0 &&
    groups[0].members.every(
      m =>
        m.ownText === null &&
        m.silahChars.length === 0 &&
        m.verseEnd === null &&
        m.wordCount === null,
    )
  );
}

/** A word with no row: one group of all 8, nothing to note. The index holds
 *  no text for it: hafsText is null and the group's text is ''. */
export function alikeReadings(
  verseKey: string,
  positions: readonly number[],
): WordReadings {
  return {
    verseKey,
    positions: [...positions],
    hafsText: null,
    groups: [
      {
        kind: 'asHafs',
        text: '',
        members: READINGS_REWAYAT.map(rewayah => ({
          rewayah,
          ownText: null,
          category: null,
          silahChars: [],
          verseEnd: null,
          wordCount: null,
          questioned: false,
        })),
      },
    ],
    alike: true,
    basmalaUnnumberedIn: [],
  };
}

/**
 * The readings of one word-by-word word that covers several DK slots (WBW
 * بَعْدَ مَا over two). Parts that read alike combine; parts that are the
 * same span row combine; anything else would mean guessing how two words'
 * readings pair up, so it throws ReadingsFormatError instead.
 */
export function combineReadings(parts: readonly WordReadings[]): WordReadings {
  if (parts.length === 0) {
    throw new ReadingsFormatError('combine', 'no readings to combine');
  }
  if (parts.length === 1) return parts[0];
  const verseKey = parts[0].verseKey;
  const positions = [...new Set(parts.flatMap(p => p.positions))].sort(
    (a, b) => a - b,
  );
  if (parts.some(p => p.verseKey !== verseKey)) {
    throw new ReadingsFormatError(verseKey, 'parts of two verses');
  }
  if (parts.every(p => p.alike)) {
    return alikeReadings(verseKey, positions);
  }
  const first = JSON.stringify({...parts[0], positions: []});
  if (parts.every(p => JSON.stringify({...p, positions: []}) === first)) {
    return {...parts[0], positions};
  }
  throw new ReadingsFormatError(
    `${verseKey}:${positions.join('-')}`,
    'readings of several words cannot be combined',
  );
}

/** Verses whose word-by-word data writes بَعْدَ مَا as one word over two DK
 *  slots: Hafs verse key → that word's WBW position (checked against
 *  wbw-en.db by dkReadingsIndex.alldbs.test.ts). */
export const WBW_JOINED_WORDS: Readonly<Record<string, number>> = {
  '2:181': 3,
  '8:6': 4,
  '13:37': 8,
};

/** The DK positions of the word at WBW position `wbwPosition`. */
export function dkPositionsForWbwWord(
  verseKey: string,
  wbwPosition: number,
): number[] {
  const joined = WBW_JOINED_WORDS[verseKey];
  if (joined === undefined || wbwPosition < joined) return [wbwPosition];
  if (wbwPosition === joined) return [joined, joined + 1];
  return [wbwPosition + 1];
}

/** The group `rewayah` belongs to, or null when it is not one of the 8. */
export function findGroup(
  readings: WordReadings,
  rewayah: RewayahId,
): ReadingGroup | null {
  return (
    readings.groups.find(g => g.members.some(m => m.rewayah === rewayah)) ??
    null
  );
}
