// scripts/adhkar-content/eveningRows.ts
// Reads the six evening rows from the reviewed spec document, which is their
// single source. Edit the json evening-row blocks there, then run
//   npx tsx scripts/adhkar-content/apply-content-fixes.ts
// No '@/' imports: tsx scripts import this file.

export const EVENING_TEXTS_DOC =
  'docs/superpowers/specs/2026-10-12-evening-adhkar-texts.md';

export interface EveningRow {
  id: string;
  morningId: string;
  arabic: string;
  translation: string;
  transliteration: string | null;
  repeatCount: number;
}

const BLOCK = /```json evening-row\n([\s\S]*?)\n```/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toEveningRow(value: unknown): EveningRow {
  if (!isRecord(value)) throw new Error('evening-row block must be an object');
  const {id, morning_id, arabic, translation, transliteration, repeat_count} =
    value;
  if (
    typeof id !== 'string' ||
    typeof morning_id !== 'string' ||
    typeof arabic !== 'string' ||
    typeof translation !== 'string' ||
    !(transliteration === null || typeof transliteration === 'string') ||
    typeof repeat_count !== 'number'
  ) {
    throw new Error(`malformed evening-row block: ${JSON.stringify(value)}`);
  }
  if (id !== `evening-${morning_id}`) {
    throw new Error(`evening row ${id} must be named evening-${morning_id}`);
  }
  if (arabic.trim() === '' || translation.trim() === '') {
    throw new Error(`evening row ${id} has empty text`);
  }
  if (!Number.isInteger(repeat_count) || repeat_count < 1) {
    throw new Error(`evening row ${id} has an invalid repeat_count`);
  }
  return {
    id,
    morningId: morning_id,
    arabic,
    translation,
    transliteration,
    repeatCount: repeat_count,
  };
}

export function parseEveningRows(markdown: string): EveningRow[] {
  const rows: EveningRow[] = [];
  for (const match of markdown.matchAll(BLOCK)) {
    const parsed: unknown = JSON.parse(match[1]);
    rows.push(toEveningRow(parsed));
  }
  return rows;
}
