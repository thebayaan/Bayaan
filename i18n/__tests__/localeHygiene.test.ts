// @ai-generated
// Character and markup hygiene for every locale file in every language and the
// bundled per-language name data. Reads the JSON from disk so a file that is
// not (yet) registered in i18n/resources.ts is still checked.
import {readdirSync, readFileSync} from 'fs';
import {join} from 'path';
import {SOURCE_LANGUAGE, SUPPORTED_LANGUAGES} from '../languages';

const ROOT = join(__dirname, '..', '..');
const LOCALES = join(ROOT, 'i18n', 'locales');
const DATA_FILES = [
  'data/surahNamesAm.json',
  'data/surahMeaningsAm.json',
  'data/reciterNamesAm.json',
  'data/reciterNamesAr.json',
];

/**
 * Bidi embeddings/overrides (U+202A–202E), isolates (U+2066–2069), LRM/RLM,
 * zero-width characters and BOM, and C0/C1 controls other than \n. Isolates
 * belong in code around interpolated values, not in stored copy.
 */
const FORBIDDEN =
  // eslint-disable-next-line no-control-regex
  /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u200B-\u200D\uFEFF\u0000-\u0009\u000B-\u001F\u007F-\u009F]/gu;
const TAG = /<\/?([A-Za-z0-9][\w-]*)\s*\/?>/g;
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

type Tree = {[key: string]: string | Tree};

function readJson(path: string): Tree {
  return JSON.parse(readFileSync(path, 'utf8')) as Tree;
}

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[path] = value;
    } else {
      Object.assign(out, flatten(value, path));
    }
  }
  return out;
}

function namespaceFiles(language: string): string[] {
  return readdirSync(join(LOCALES, language))
    .filter(name => name.endsWith('.json'))
    .sort();
}

function hex(char: string): string {
  const code = (char.codePointAt(0) ?? 0).toString(16).toUpperCase();
  return `U+${code.padStart(4, '0')}`;
}

function codePoints(text: string): string[] {
  return [...new Set(text.match(FORBIDDEN) ?? [])].map(hex);
}

/** Offending `key: [code points]` entries, checking keys and values. */
function forbiddenCharacters(flat: Record<string, string>): string[] {
  return Object.entries(flat)
    .map(([key, value]) => [key, codePoints(key + value)] as const)
    .filter(([, found]) => found.length > 0)
    .map(([key, found]) => `${key}: ${found.join(' ')}`);
}

/** Sorted, de-duplicated opening and closing tags, e.g. ['</brand>', '<brand>']. */
function tags(value: string): string[] {
  return [
    ...new Set(
      [...value.matchAll(TAG)].map(match => match[0].replace(/\s/g, '')),
    ),
  ].sort();
}

const files = SUPPORTED_LANGUAGES.flatMap(language =>
  namespaceFiles(language).map(name => ({language, name})),
);

describe('locale hygiene', () => {
  it('finds locale files for every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect({language, files: namespaceFiles(language).length > 0}).toEqual({
        language,
        files: true,
      });
    }
  });

  describe.each(files)('$language/$name', ({language, name}) => {
    const flat = flatten(readJson(join(LOCALES, language, name)));
    const source = flatten(readJson(join(LOCALES, SOURCE_LANGUAGE, name)));
    const sourceKeys = new Set(Object.keys(source));
    const pluralBases = new Set(
      Object.keys(source)
        .filter(key => PLURAL_SUFFIX.test(key))
        .map(key => key.replace(PLURAL_SUFFIX, '')),
    );

    it('has no bidi, zero-width or control characters other than \\n', () => {
      expect(forbiddenCharacters(flat)).toEqual([]);
    });

    it('uses the same markup tags as English for every key', () => {
      const mismatches: string[] = [];
      for (const [key, value] of Object.entries(flat)) {
        // A plural form English lacks (Arabic _few) compares with English _other.
        const base = key.replace(PLURAL_SUFFIX, '');
        let english: string | undefined = source[key];
        if (!sourceKeys.has(key) && pluralBases.has(base)) {
          english = source[`${base}_other`];
        }
        if (english === undefined) continue;
        const expected = tags(english).join(' ');
        const actual = tags(value).join(' ');
        if (actual !== expected) {
          mismatches.push(`${key}: [${actual}] vs English [${expected}]`);
        }
      }
      expect(mismatches).toEqual([]);
    });

    it("defines no plural categories the language doesn't have", () => {
      const categories = new Set<string>(
        new Intl.PluralRules(language).resolvedOptions().pluralCategories,
      );
      const extra = Object.keys(flat).filter(key => {
        const match = PLURAL_SUFFIX.exec(key);
        return (
          match !== null &&
          pluralBases.has(key.replace(PLURAL_SUFFIX, '')) &&
          !categories.has(match[1])
        );
      });
      expect(extra).toEqual([]);
    });
  });
});

describe.each(DATA_FILES)('bundled name data %s', file => {
  it('has no bidi, zero-width or control characters other than \\n', () => {
    expect(forbiddenCharacters(flatten(readJson(join(ROOT, file))))).toEqual(
      [],
    );
  });
});

describe('hygiene helpers', () => {
  it('report forbidden characters by key, including JSON escapes', () => {
    const flat = flatten(
      JSON.parse(
        '{"a":{"b":"x\\u200fy"},"ok":"line\\nbreak","c":"\\u2068\\u0007"}',
      ),
    );
    expect(forbiddenCharacters(flat)).toEqual([
      'a.b: U+200F',
      'c: U+2068 U+0007',
    ]);
  });

  it('compare tag names, not attributes or text', () => {
    expect(tags('Made by <brand>Bayaan</brand> and <1/>')).toEqual([
      '</brand>',
      '<1/>',
      '<brand>',
    ]);
    expect(tags('a < b > c')).toEqual([]);
  });
});
