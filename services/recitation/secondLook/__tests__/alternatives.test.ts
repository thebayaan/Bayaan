import {createHash} from 'crypto';
import fs from 'fs';
import path from 'path';
import {alternativesOf} from '../alternatives';

// The exact match is against the judge's own index, which the bench builds from the
// pinned official text (scripts/recitation-bench/judge/build_index.py) and keeps out
// of the repo. Without it the pin below still holds the table to the same lists:
// scripts/second-look/build_alternatives.mjs wrote the table and printed its hash.
const INDEX = path.resolve(
  __dirname,
  '../../../../scripts/recitation-bench/.out/natural/judge/index.json',
);
const haveIndex = fs.existsSync(INDEX);
const TABLE = path.resolve(__dirname, '../alternatives.json');
const PIN = '4e2f0c1eca713ee68db0a2acb7fbb59061e0a7ac951a58d90a84978c52051efa';

describe('alternativesOf', () => {
  it('gives a word its alternatives, as letters', () => {
    expect(alternativesOf(1, 1, 1)).toEqual(['من']);
    expect(alternativesOf(1, 1, 2)).toEqual(['العزيز', 'مجريها']);
  });

  it('gives none to a word that has none', () => {
    expect(alternativesOf(1, 1, 0)).toEqual([]);
    expect(alternativesOf(1, 1, 3)).toEqual([]);
  });

  it('gives none past the end of an ayah, or for an ayah that is not there', () => {
    expect(alternativesOf(1, 1, 4)).toEqual([]);
    expect(alternativesOf(1, 8, 0)).toEqual([]);
    expect(alternativesOf(115, 1, 0)).toEqual([]);
  });

  it('reads a table held to its pin', () => {
    const bytes = fs.readFileSync(TABLE);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(PIN);
  });

  (haveIndex ? it : it.skip)(
    "matches the judge's index exactly on every word",
    () => {
      const index = JSON.parse(fs.readFileSync(INDEX, 'utf8')) as {
        types: string[];
        ayat: Record<string, {m: number[]}[]>;
      };
      let words = 0;
      const differ: string[] = [];
      for (const [key, rows] of Object.entries(index.ayat)) {
        const [surah, ayah] = key.split(':').map(Number);
        rows.forEach((row, word) => {
          words += 1;
          const expected = row.m.map(id => index.types[id]).join(',');
          if (alternativesOf(surah, ayah, word).join(',') !== expected) {
            differ.push(`${key}:${word}`);
          }
        });
      }
      expect(words).toBe(77430);
      expect(differ).toEqual([]);
    },
  );
});
