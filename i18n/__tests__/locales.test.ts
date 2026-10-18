// @ai-generated
import {resources, namespaces} from '../resources';
import {LANGUAGES, SOURCE_LANGUAGE, SUPPORTED_LANGUAGES} from '../languages';

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const PLACEHOLDER = /{{\s*([\w.]+)\s*(?:,[^}]*)?}}/g;

type Tree = {[key: string]: string | Tree};

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

/** Groups keys by base key, merging plural variants. */
function group(flat: Record<string, string>) {
  const groups = new Map<string, {plural: boolean; values: string[]}>();
  for (const [key, value] of Object.entries(flat)) {
    const plural = PLURAL_SUFFIX.test(key);
    const base = key.replace(PLURAL_SUFFIX, '');
    const entry = groups.get(base) ?? {plural, values: []};
    entry.plural = entry.plural || plural;
    entry.values.push(value);
    groups.set(base, entry);
  }
  return groups;
}

function placeholders(values: string[], ignoreCount: boolean): string[] {
  const names = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(PLACEHOLDER)) {
      if (!(ignoreCount && match[1] === 'count')) names.add(match[1]);
    }
  }
  return [...names].sort();
}

/** CLDR plural categories, from Node's full ICU data. */
function pluralCategories(language: string): string[] {
  return new Intl.PluralRules(language).resolvedOptions().pluralCategories;
}

const translatedLanguages = SUPPORTED_LANGUAGES.filter(
  language => language !== SOURCE_LANGUAGE,
);

describe.each(namespaces)('locale namespace "%s"', ns => {
  const flatSource = flatten(resources[SOURCE_LANGUAGE][ns] as Tree);
  const source = group(flatSource);

  it('has no empty strings in the source language', () => {
    for (const [key, {values}] of source) {
      for (const value of values) {
        expect({key, empty: value.trim() === ''}).toEqual({key, empty: false});
      }
    }
  });

  it('defines every source plural category for each plural key', () => {
    const categories = pluralCategories(SOURCE_LANGUAGE);
    for (const [key, {plural}] of source) {
      if (!plural) continue;
      const missing = categories.filter(c => !(`${key}_${c}` in flatSource));
      expect({key, missing}).toEqual({key, missing: []});
    }
  });

  describe.each(translatedLanguages)('%s', language => {
    const flat = flatten(resources[language][ns] as Tree);
    const translated = group(flat);
    const {status} = LANGUAGES[language];

    it('has no keys that the source language lacks', () => {
      const extra = [...translated.keys()].filter(key => !source.has(key));
      expect(extra).toEqual([]);
    });

    if (status === 'shipped') {
      it('has every source key (shipped languages are complete)', () => {
        const missing = [...source.keys()].filter(key => !translated.has(key));
        expect(missing).toEqual([]);
      });
    }

    it('has no empty strings', () => {
      for (const [key, {values}] of translated) {
        for (const value of values) {
          expect({key, empty: value.trim() === ''}).toEqual({
            key,
            empty: false,
          });
        }
      }
    });

    it('uses the same interpolation variables as the source', () => {
      for (const [key, sourceEntry] of source) {
        const entry = translated.get(key);
        if (!entry) continue;
        const ignoreCount = sourceEntry.plural;
        expect({key, vars: placeholders(entry.values, ignoreCount)}).toEqual({
          key,
          vars: placeholders(sourceEntry.values, ignoreCount),
        });
      }
    });

    it("defines every one of the language's plural categories", () => {
      const categories = pluralCategories(language);
      for (const [key, {plural}] of source) {
        if (!plural || !translated.has(key)) continue;
        const missing = categories.filter(c => !(`${key}_${c}` in flat));
        expect({key, missing}).toEqual({key, missing: []});
      }
    });
  });
});
