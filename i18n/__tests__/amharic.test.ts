// @ai-generated
import {createInstance} from 'i18next';
import {readFileSync} from 'fs';
import {join} from 'path';
import {resources} from '../resources';
import {getLanguageConfig, SHIPPED_LANGUAGES} from '../languages';
import {
  getAppDisplayName,
  getSurahDisplayName,
  localizeDigits,
  formatNumber,
} from '../format';
import {SURAHS} from '@/data/surahData';
import sourceValues from '../../docs/i18n/amharic-source-values.json';

it('keeps the Amharic draft LTR, in progress and out of release languages', () => {
  expect(getLanguageConfig('am')).toMatchObject({
    endonym: 'አማርኛ',
    status: 'inProgress',
    direction: 'ltr',
    script: 'Ethi',
    digits: 'latn',
    bilingualContent: 'en',
    understandsArabic: false,
    uiFont: 'manropeEthiopic',
  });
  expect(SHIPPED_LANGUAGES).toEqual(['en', 'ar']);
});
it('transliterates only the display brand and preserves forks and existing languages', () => {
  expect(getAppDisplayName('Bayaan', 'am')).toBe('በያን');
  expect(getAppDisplayName('Bayaan', 'en')).toBe('Bayaan');
  expect(getAppDisplayName('Bayaan', 'ar')).toBe('Bayaan');
  expect(getAppDisplayName('Original fork', 'am')).toBe('Original fork');
});
it('retains canonical Latin reference digits and original surah data names', () => {
  expect(localizeDigits('2:255', 'am')).toBe('2:255');
  expect(formatNumber(12345, 'am')).toBe('12,345');
  expect(getSurahDisplayName(SURAHS[0], 'am')).toBe(
    getSurahDisplayName(SURAHS[0], 'en'),
  );
});
it('uses the upstream framework, Amharic plurals and canonical source labels', async () => {
  const instance = createInstance();
  await instance.init({
    resources,
    lng: 'am',
    fallbackLng: 'en',
    defaultNS: 'common',
    initAsync: false,
    interpolation: {escapeValue: false},
  });
  expect(instance.t('terms.reciter')).toBe('አንባቢ');
  expect(instance.t('app.sharedAudio')).toBe('Shared Audio');
  expect(instance.t('languageRestart.title')).toBe('እንደገና ማስጀመር ያስፈልጋል');
  expect(instance.t('counts.reciters', {count: 0})).toBe('0 አንባቢ');
  expect(instance.t('counts.reciters', {count: 1})).toBe('1 አንባቢ');
  expect(instance.t('counts.reciters', {count: 2})).toBe('2 አንባቢዎች');
});
it('preserves catalog names, outgoing payload templates and reference notation', () => {
  const lookup = (language: 'en' | 'am', key: string): unknown => {
    const [namespace, path] = key.split(':');
    let value: unknown = resources[language];
    for (const part of [namespace, ...path.split('.')]) {
      if (typeof value !== 'object' || value === null) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  };
  for (const key of Object.values(sourceValues).flat()) {
    expect({key, value: lookup('am', key)}).toEqual({
      key,
      value: lookup('en', key),
    });
    expect(typeof lookup('en', key)).toBe('string');
  }
});
it('localizes reader failures and keeps Trans brand markup and provider names intact', async () => {
  const instance = createInstance();
  await instance.init({
    resources,
    lng: 'am',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {escapeValue: false},
  });
  const failure = instance.t('reader:verseUnits.loadFailed', {
    rewayah: 'Warsh',
  });
  expect(failure).toContain('Warsh');
  expect(failure).toMatch(/[\u1200-\u139f]/);
  expect(failure).not.toContain('{{');
  expect(instance.t('settings:whatsNew.title', {appName: 'በያን'})).toContain(
    '<brand>በያን</brand>',
  );
  expect(
    instance.t('sheets:playlistContext.itemsProgress', {
      current: 2,
      count: 5,
    }),
  ).toBe('2 ከ5 ንጥሎች');
  // Specialist reference explanations continue to use the original source.
  expect(instance.t('sheets:rewayatInfo.explanation')).toBe(
    resources.en.sheets.rewayatInfo.explanation,
  );
});
it('keeps Amharic out of native released-language declarations until review', () => {
  const config = readFileSync(join(__dirname, '../../app.config.js'), 'utf8');
  const declared = /supportedLocales:\s*{\s*ios:\s*\[([^\]]*)\]/.exec(
    config,
  )?.[1];
  expect(declared).toBeDefined();
  expect(declared).not.toMatch(/['"]am['"]/);
});
it('labels every seeded adhkar super category, keeping English and Arabic titles', () => {
  const source = readFileSync(
    join(__dirname, '../../services/database/AdhkarDatabaseService.ts'),
    'utf8',
  );
  const seeded = [
    ...source
      .slice(source.indexOf('async seedSuperCategories'))
      .matchAll(
        /id: '([^']+)',\s*title: '([^']+)',\s*arabic_title: '([^']+)'/g,
      ),
  ].map(([, id, title, arabicTitle]) => ({id, title, arabicTitle}));
  expect(seeded.length).toBeGreaterThan(0);
  const labels = (lang: 'en' | 'ar' | 'am') =>
    resources[lang].content.adhkarSuperCategories as Record<string, string>;
  expect(Object.keys(labels('en')).sort()).toEqual(
    seeded.map(category => category.id).sort(),
  );
  for (const {id, title, arabicTitle} of seeded) {
    expect(labels('en')[id]).toBe(title);
    expect(labels('ar')[id]).toBe(arabicTitle);
    expect(labels('am')[id]).toMatch(/[ሀ-፿]/);
  }
});
