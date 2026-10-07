jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import crypto from 'crypto';
import fs from 'fs';
import {resetDatabases} from '@/test-utils/mockExpoSqlite';
import {assertSnapshotFresh} from '@/scripts/parity/snapshot';
import {parseTafsirSnapshot} from '../tafsirSnapshot';
import type {QfSnapshot} from '@/types/content';

// Ibn Kathir parity: the QF tafsir 169 snapshot, run through
// parseTafsirSnapshot, against today's bundled import
// (data/ibn-kathir-tafseer-compact.json). Both sides go through the real
// TafseerDbService and the real-SQLite expo-sqlite mock, then rows are compared
// by verse_key. Opt in with QF_PARITY_SNAPSHOT=<path to a fetched snapshot
// JSON> (scripts/parity/fetch-qf-snapshot.ts writes .parity/tafsir-169.json).
// QF text is never stored in the repo; this file only names verse keys.
const SNAPSHOT_PATH = process.env.QF_PARITY_SNAPSHOT;
const describeParity = SNAPSHOT_PATH ? describe : describe.skip;

// The bundled JSON has no entry for surah 105 (Al-Fil); QF has it as one group.
const MISSING_FROM_BUNDLED = ['105:1', '105:2', '105:3', '105:4', '105:5'];

// Tatweel (U+0640, Arabic kashida) is a purely typographic elongation. The
// bundled text carries it inside Arabic words (for example "الرَّحْمَـنِ") where
// QF does not ("الرَّحْمَنِ"). Groups whose texts are equal once U+0640 is
// removed from both sides are pinned here by count and by the sha256 of their
// sorted group verse keys (one key per line), instead of listing ~1.6k keys.
const TATWEEL_ONLY_GROUPS = 1574;
const TATWEEL_ONLY_DIGEST =
  '7b08af2bf225e30564677a31bbf1c3be60ce0d36a5b127bbc782e085ef0358ab';

// Groups whose texts still differ after whitespace normalization and tatweel
// removal: QF serves a revised edition of the abridged Ibn Kathir. Keys are
// group leaders (group_verse_key); every member verse inherits the leader text.
// Derived from a real run against QF tafsir 169 on 2026-10-07.
const EDITORIAL_GROUPS = [
  // Arabic only: Quran and hadith orthography (alif forms such as "ا" vs "ٱ",
  // "الاٌّ" vs "الأَ" hamza spellings, harakat corrections).
  ...['2:61', '2:74', '2:94', '2:145', '3:48', '3:96', '16:125', '17:101'],
  ...['18:30', '24:63', '25:35', '37:20', '39:10', '40:69', '53:27', '76:13'],
  // Punctuation only: commas, periods, quote and dash styles.
  ...['5:15', '44:17', '53:56', '58:1', '113:1'],
  // English wording, spelling, capitalisation, punctuation and markup edits,
  // often mixed with Arabic orthography fixes. Notable: 1:1 drops the bundled
  // styled "<h1><span style=...>" heading for a plain "<h2>"; 11:103 drops a
  // section heading; 2:57 and 2:282 drop stray digits and symbols.
  ...['1:1', '1:7', '2:6', '2:26', '2:57', '2:58', '2:65', '2:78', '2:84'],
  ...['2:122', '2:174', '2:187', '2:189', '2:204', '2:214', '2:229', '2:243'],
  ...['2:272', '2:275', '2:282', '2:285', '3:33', '3:52', '3:77', '3:81'],
  ...['3:83', '3:118', '3:137', '3:154', '4:32', '4:88', '4:103', '4:144'],
  ...['4:160', '5:3', '5:51', '6:148', '6:159', '7:57', '7:164', '7:172'],
  ...['7:180', '7:191', '8:17', '8:19', '8:24', '8:67', '9:16', '9:111'],
  ...['9:118', '10:79', '11:80', '11:103', '11:116', '12:50', '13:8', '16:19'],
  ...['16:30', '16:56', '16:80', '17:1', '17:60', '18:92', '19:24', '24:6'],
  ...['24:11', '26:60', '29:53', '31:31', '33:32', '34:10', '34:18', '34:51'],
  ...['37:88', '37:139', '39:27', '39:53', '41:25', '43:15', '43:57', '47:4'],
  ...['53:5', '53:19', '53:31', '53:33', '55:1', '56:13', '57:4', '59:1'],
  ...['59:21', '61:14', '62:1', '63:5', '63:9', '66:1', '69:44', '72:1'],
  ...['73:19', '74:38', '76:1', '77:16', '78:17', '78:37', '83:1', '83:7'],
  ...['88:17', '93:1', '96:6', '99:1', '102:1', '108:1', '114:1'],
];

interface DbRow {
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  text: string;
  group_verse_key: string | null;
  from_ayah: number | null;
  to_ayah: number | null;
}

type Service =
  typeof import('@/services/tafseer/TafseerDbService').tafseerDbService;
type MockModule = typeof import('@/test-utils/mockExpoSqlite');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadSnapshot(file: string): QfSnapshot {
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    !isRecord(parsed) ||
    typeof parsed.resource_group !== 'string' ||
    typeof parsed.resource_id !== 'number' ||
    typeof parsed.schema_version !== 'number' ||
    !Array.isArray(parsed.records)
  ) {
    throw new Error(`${file} is not a QF snapshot response`);
  }
  return {
    resource_group: parsed.resource_group,
    resource_id: parsed.resource_id,
    schema_version: parsed.schema_version,
    records: parsed.records.filter(isRecord),
  };
}

// Whitespace only: collapse runs, drop whitespace touching a tag, trim.
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*(<[^>]*>)\s*/g, '$1')
    .trim();
}

function withoutTatweel(text: string): string {
  return normalizeWhitespace(text.replace(/ـ/g, ''));
}

function compareKeys(a: string, b: string): number {
  const [sa, aa] = a.split(':').map(Number);
  const [sb, ab] = b.split(':').map(Number);
  return sa - sb || aa - ab;
}

function byKey(rows: DbRow[]): Map<string, DbRow> {
  return new Map(rows.map(row => [row.verse_key, row]));
}

const SELECT_ROWS =
  'SELECT verse_key, surah_number, ayah_number, text, group_verse_key, from_ayah, to_ayah FROM tafaseer WHERE identifier = ? ORDER BY surah_number, ayah_number';

beforeEach(async () => {
  await resetDatabases();
});

describeParity('QF tafsir 169 parity with the bundled Ibn Kathir', () => {
  it('differs only by the documented allowlists', async () => {
    const file = SNAPSHOT_PATH ?? '';
    // QF terms: no cached snapshot older than 7 days may be used.
    assertSnapshotFresh(file);
    const parsed = parseTafsirSnapshot(loadSnapshot(file));

    let svc: Service | undefined;
    let mock: MockModule | undefined;
    jest.isolateModules(() => {
      svc = require('@/services/tafseer/TafseerDbService').tafseerDbService;
      mock = require('@/test-utils/mockExpoSqlite');
    });
    if (!svc || !mock) throw new Error('service not loaded');
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await svc.initialize();
    await svc.importBundledIbnKathir();
    await svc.saveTafseer('qf-parity', 'QF', 'QF', 'English', 'ltr', parsed);
    const db = await mock.openDatabaseAsync('tafaseer.db');
    const bundled = byKey(await db.getAllAsync<DbRow>(SELECT_ROWS, ['169']));
    const qf = byKey(await db.getAllAsync<DbRow>(SELECT_ROWS, ['qf-parity']));

    expect(bundled.size).toBe(6231);
    expect(qf.size).toBe(6236);

    const missingFromBundled = [...qf.keys()].filter(k => !bundled.has(k));
    const missingFromQf = [...bundled.keys()].filter(k => !qf.has(k));
    expect(missingFromBundled.sort(compareKeys)).toEqual(MISSING_FROM_BUNDLED);
    expect(missingFromQf).toEqual([]);

    const rangeDiffs: string[] = [];
    const textDiffs: string[] = [];
    const tatweelGroups = new Set<string>();
    const editorialGroups = new Set<string>();
    for (const [key, b] of bundled) {
      const q = qf.get(key);
      if (!q) continue;
      if (
        q.group_verse_key !== b.group_verse_key ||
        q.from_ayah !== b.from_ayah ||
        q.to_ayah !== b.to_ayah
      ) {
        rangeDiffs.push(key);
      }
      if (normalizeWhitespace(q.text) === normalizeWhitespace(b.text)) continue;
      textDiffs.push(key);
      const group = b.group_verse_key ?? key;
      if (withoutTatweel(q.text) === withoutTatweel(b.text)) {
        tatweelGroups.add(group);
      } else {
        editorialGroups.add(group);
      }
    }

    expect(rangeDiffs).toEqual([]);
    expect([...editorialGroups].sort(compareKeys)).toEqual(
      [...EDITORIAL_GROUPS].sort(compareKeys),
    );
    const tatweelKeys = [...tatweelGroups].sort(compareKeys);
    expect(tatweelKeys).toHaveLength(TATWEEL_ONLY_GROUPS);
    expect(
      crypto.createHash('sha256').update(tatweelKeys.join('\n')).digest('hex'),
    ).toBe(TATWEEL_ONLY_DIGEST);
    // Logged for the parity report: verse-level totals behind the group lists.
    process.stdout.write(
      `parity: ${textDiffs.length} verse rows differ in text (${tatweelGroups.size} tatweel-only groups, ${editorialGroups.size} editorial groups)\n`,
    );
  }, 120000);
});
