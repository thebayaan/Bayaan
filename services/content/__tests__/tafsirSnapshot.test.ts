import fs from 'fs';
import path from 'path';
import {parseTafsirSnapshot} from '../tafsirSnapshot';
import type {QfSnapshot} from '@/types/content';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadEnvelopeSnapshot(): QfSnapshot {
  const file = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'contracts',
    'content',
    'v1',
    'envelope-tafsir.json',
  );
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!isRecord(parsed) || !isRecord(parsed.snapshot))
    throw new Error('bad envelope fixture');
  const {snapshot: raw} = parsed;
  if (!Array.isArray(raw.records)) throw new Error('bad envelope fixture');
  return snapshot(raw.records.filter(isRecord));
}

function snapshot(records: Array<Record<string, unknown>>): QfSnapshot {
  return {
    resource_group: 'tafsirs',
    resource_id: 169,
    schema_version: 1,
    records,
  };
}

describe('parseTafsirSnapshot', () => {
  it('maps single-verse rows', () => {
    const verses = parseTafsirSnapshot(
      snapshot([
        {verse_id: 1, verse_key: '1:1', text: '<p>One</p>'},
        {verse_id: 2, verse_key: '1:2', text: '<p>Two</p>'},
      ]),
    );
    expect(verses).toEqual([
      {
        surahNumber: 1,
        ayahNumber: 1,
        verseKey: '1:1',
        text: '<p>One</p>',
        groupVerseKey: '1:1',
        fromAyah: 1,
        toAyah: 1,
      },
      {
        surahNumber: 1,
        ayahNumber: 2,
        verseKey: '1:2',
        text: '<p>Two</p>',
        groupVerseKey: '1:2',
        fromAyah: 2,
        toAyah: 2,
      },
    ]);
  });

  it('folds empty continuation rows into the leader group, in verse order', () => {
    const verses = parseTafsirSnapshot(
      snapshot([
        {verse_id: 16, verse_key: '2:9', text: ''},
        {verse_id: 15, verse_key: '2:8', text: '<p>Group</p>'},
        {verse_id: 17, verse_key: '2:10', text: null},
        {verse_id: 18, verse_key: '2:11', text: '<p>Next</p>'},
      ]),
    );
    expect(
      verses.map(v => [
        v.verseKey,
        v.text,
        v.groupVerseKey,
        v.fromAyah,
        v.toAyah,
      ]),
    ).toEqual([
      ['2:8', '<p>Group</p>', '2:8', 8, 10],
      ['2:9', '<p>Group</p>', '2:8', 8, 10],
      ['2:10', '<p>Group</p>', '2:8', 8, 10],
      ['2:11', '<p>Next</p>', '2:11', 11, 11],
    ]);
  });

  it('drops leading empty rows and invalid keys', () => {
    const verses = parseTafsirSnapshot(
      snapshot([
        {verse_id: 1, verse_key: '1:1', text: ''},
        {verse_id: 2, verse_key: 'bad', text: '<p>x</p>'},
        {verse_id: 3, verse_key: '1:3', text: '<p>ok</p>'},
      ]),
    );
    expect(verses.map(v => v.verseKey)).toEqual(['1:3']);
  });

  it('parses the contract envelope fixture (a 2-verse group plus a single)', () => {
    const verses = parseTafsirSnapshot(loadEnvelopeSnapshot());
    const group = '<p>Synthetic tafsir group for verses one and two</p>';
    expect(verses).toEqual([
      {
        surahNumber: 1,
        ayahNumber: 1,
        verseKey: '1:1',
        text: group,
        groupVerseKey: '1:1',
        fromAyah: 1,
        toAyah: 2,
      },
      {
        surahNumber: 1,
        ayahNumber: 2,
        verseKey: '1:2',
        text: group,
        groupVerseKey: '1:1',
        fromAyah: 1,
        toAyah: 2,
      },
      {
        surahNumber: 1,
        ayahNumber: 3,
        verseKey: '1:3',
        text: '<p>Synthetic tafsir for verse three</p>',
        groupVerseKey: '1:3',
        fromAyah: 3,
        toAyah: 3,
      },
    ]);
  });
});
