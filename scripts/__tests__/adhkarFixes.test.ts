// scripts/__tests__/adhkarFixes.test.ts
import fs from 'fs';
import path from 'path';
import {
  applyAllFixes,
  applyAudioFixes,
  parseSeedFile,
  serializeSeedFile,
} from '../adhkar-content/adhkarFixes';
import type {SeedRow} from '../adhkar-content/adhkarFixes';
import {
  EVENING_TEXTS_DOC,
  parseEveningRows,
} from '../adhkar-content/eveningRows';

const root = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function block(body: string): string {
  return ['```json evening-row', body, '```'].join('\n');
}

const goodRow = JSON.stringify({
  id: 'evening-77',
  morning_id: '77',
  arabic: 'أَمْسَيْنَا',
  translation: 'We have entered the evening.',
  transliteration: null,
  repeat_count: 1,
});

describe('parseEveningRows', () => {
  it('reads every json evening-row block and ignores other code blocks', () => {
    const md = [
      '# Doc',
      '```json',
      '{"id": "not-a-row"}',
      '```',
      block(goodRow),
    ].join('\n');
    expect(parseEveningRows(md)).toEqual([
      {
        id: 'evening-77',
        morningId: '77',
        arabic: 'أَمْسَيْنَا',
        translation: 'We have entered the evening.',
        transliteration: null,
        repeatCount: 1,
      },
    ]);
  });

  it('rejects an id that does not match its morning row', () => {
    const bad = goodRow.replace('"evening-77"', '"evening-78"');
    expect(() => parseEveningRows(block(bad))).toThrow('evening-77');
  });

  it('rejects empty text and a non-positive repeat count', () => {
    expect(() =>
      parseEveningRows(block(goodRow.replace('أَمْسَيْنَا', ' '))),
    ).toThrow('empty');
    expect(() =>
      parseEveningRows(
        block(goodRow.replace('"repeat_count":1', '"repeat_count":0')),
      ),
    ).toThrow('repeat_count');
  });

  it('reads the six reviewed rows from the spec document', () => {
    expect(parseEveningRows(read(EVENING_TEXTS_DOC)).map(r => r.id)).toEqual([
      'evening-77',
      'evening-78',
      'evening-80',
      'evening-81',
      'evening-89',
      'evening-90',
    ]);
  });
});

describe('adhkar content fixes', () => {
  const raw = read('data/adhkar.json');
  const parsed: unknown = JSON.parse(raw);
  const seed = parseSeedFile(parsed);

  it('round-trips data/adhkar.json byte for byte', () => {
    expect(serializeSeedFile(seed)).toBe(raw);
  });

  it('are applied to data/adhkar.json (run npx tsx scripts/adhkar-content/apply-content-fixes.ts)', () => {
    expect(
      serializeSeedFile(applyAllFixes(seed, read(EVENING_TEXTS_DOC))),
    ).toBe(raw);
  });
});

describe('applyAudioFixes', () => {
  function seedRow(id: string, audioUrl: string | null): SeedRow {
    return {
      id,
      category_id: '27',
      category_name: 'c',
      arabic: id,
      translation: null,
      transliteration: null,
      instruction: null,
      repeat_count: 1,
      audio_url: audioUrl,
      order_index: 0,
      audio_file: null,
    };
  }

  it('sets evening files, fixes the 72 and 149 urls and writes the evening overrides', () => {
    const fixed = applyAudioFixes({
      categories: [],
      adhkar: [
        seedRow('evening-78', null),
        seedRow('72', 'http://www.hisnmuslim.com/audio/ar/73.mp3'),
        seedRow('149', 'http://www.hisnmuslim.com/audio/ar/49.mp3'),
        seedRow('96', null),
      ],
      meta: null,
    });
    expect(fixed.adhkar.map(r => [r.id, r.audio_file, r.audio_url])).toEqual([
      ['evening-78', 'adhkar_evening_78.mp3', null],
      ['72', null, 'http://www.hisnmuslim.com/audio/ar/72.mp3'],
      ['149', null, 'http://www.hisnmuslim.com/audio/ar/149.mp3'],
      ['96', null, null],
    ]);
    const evening = fixed.super_category_audio_overrides?.['evening-adhkar'];
    expect(evening?.['75']).toBe('adhkar_evening_75.mp3');
    expect(evening && Object.hasOwn(evening, '96')).toBe(false);
    expect(Object.keys(evening ?? {})).toHaveLength(13);
  });

  it('rejects malformed overrides', () => {
    expect(() =>
      parseSeedFile({
        categories: [],
        adhkar: [],
        super_category_audio_overrides: {'evening-adhkar': {'75': 1}},
      }),
    ).toThrow('not a file name');
  });
});
