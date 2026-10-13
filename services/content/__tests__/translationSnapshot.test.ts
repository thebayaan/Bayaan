import {SURAHS} from '@/data/surahData';
import type {QfSnapshot} from '@/types/content';
import {parseTranslationSnapshot, VERSE_COUNT} from '../translationSnapshot';

// One record per verse of the Quran, in order.
function fullRecords(): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];
  for (const surah of SURAHS) {
    for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
      records.push({
        verse_key: `${surah.id}:${ayah}`,
        text: `t ${surah.id}:${ayah}`,
        foot_notes: [],
      });
    }
  }
  return records;
}

function snapshot(records: Array<Record<string, unknown>>): QfSnapshot {
  return {
    resource_group: 'translations',
    resource_id: 20,
    schema_version: 1,
    records,
  };
}

describe('parseTranslationSnapshot', () => {
  it('maps every verse of a complete snapshot', () => {
    const {verses, footnotes} = parseTranslationSnapshot(
      snapshot(fullRecords()),
    );
    expect(verses).toHaveLength(VERSE_COUNT);
    expect(verses[0]).toEqual({
      surahNumber: 1,
      ayahNumber: 1,
      verseKey: '1:1',
      text: 't 1:1',
    });
    expect(verses[VERSE_COUNT - 1].verseKey).toBe('114:6');
    expect(footnotes).toEqual([]);
  });

  it('keeps marker text verbatim and collects footnotes with string ids', () => {
    const records = fullRecords();
    records[0] = {
      verse_key: '1:1',
      text: 'In the name of Allah,<sup foot_note=254011>1</sup>',
      foot_notes: [{id: 254011, text: '<p>A note</p>', language_id: 38}],
    };
    // The same footnote repeated on another record is stored once.
    records[1] = {
      verse_key: '1:2',
      text: 'Praise<sup foot_note=254011>1</sup>',
      foot_notes: [{id: '254011', text: '<p>Later copy</p>'}],
    };
    // foot_notes may be missing or null.
    records[2] = {verse_key: '1:3', text: 'three'};
    records[3] = {verse_key: '1:4', text: 'four', foot_notes: null};
    const {verses, footnotes} = parseTranslationSnapshot(snapshot(records));
    expect(verses[0].text).toBe(
      'In the name of Allah,<sup foot_note=254011>1</sup>',
    );
    expect(footnotes).toEqual([{id: '254011', text: '<p>A note</p>'}]);
  });

  it('rejects a short snapshot', () => {
    expect(() =>
      parseTranslationSnapshot(snapshot(fullRecords().slice(1))),
    ).toThrow('translation_verse_count');
  });

  it('rejects duplicate verse keys', () => {
    const records = fullRecords();
    records[1] = {...records[0]};
    expect(() => parseTranslationSnapshot(snapshot(records))).toThrow(
      'translation_duplicate_verse',
    );
  });

  it('rejects verse keys outside the Quran', () => {
    for (const bad of ['1:8', '115:1', '0:1', '2:0', 'x', 7]) {
      const records = fullRecords();
      records[0] = {verse_key: bad, text: 'x'};
      expect(() => parseTranslationSnapshot(snapshot(records))).toThrow(
        'translation_bad_verse_key',
      );
    }
  });

  it('rejects a record without string text', () => {
    const records = fullRecords();
    records[5] = {verse_key: records[5].verse_key, text: null};
    expect(() => parseTranslationSnapshot(snapshot(records))).toThrow(
      'translation_bad_text',
    );
  });

  it('rejects malformed footnotes', () => {
    for (const bad of [
      'x',
      [{id: 1}],
      [{text: 'no id'}],
      [{id: '', text: 'x'}],
      ['x'],
    ]) {
      const records = fullRecords();
      records[0] = {verse_key: '1:1', text: 'x', foot_notes: bad};
      expect(() => parseTranslationSnapshot(snapshot(records))).toThrow(
        'translation_bad_footnotes',
      );
    }
  });
});
