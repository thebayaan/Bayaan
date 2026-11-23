/**
 * Credits: what each data source is credited for, under which licence, and
 * that a licence name keeps its Latin digits in Arabic. The screen lives in
 * app/, so its test lives here.
 *
 * The screen is rendered with an i18next instance set up as the app sets up
 * its own (i18n/index.ts): Arabic runs every string through the digits
 * post-processor unless the call opts out.
 */
import React from 'react';
import {Linking} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import i18next from 'i18next';
import {I18nextProvider, initReactI18next} from 'react-i18next';
import {localizeDigits} from '@/i18n/format';
import {resources, defaultNS, namespaces} from '@/i18n/resources';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111111',
        textTertiary: '#777777',
        background: '#ffffff',
      },
      typography: {mediumSize: 14, smallSize: 12},
    },
  }),
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

import CreditsScreen from '@/app/(tabs)/(d.settings)/credits';

async function render(language: 'en' | 'ar') {
  const i18n = i18next.createInstance();
  await i18n
    .use(initReactI18next)
    .use({
      type: 'postProcessor',
      name: 'localizedDigits',
      process: (value: string) => localizeDigits(value, language),
    })
    .init({
      resources,
      lng: language,
      fallbackLng: 'en',
      ns: namespaces,
      defaultNS,
      initAsync: false,
      interpolation: {escapeValue: false},
      postProcess: language === 'en' ? false : ['localizedDigits'],
    });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <I18nextProvider i18n={i18n}>
        <CreditsScreen />
      </I18nextProvider>,
    );
  });
  const credits = new Map<string, {description: string; press: () => void}>();
  const rows = tree.root.findAll(
    node =>
      typeof node.props.onPress === 'function' && 'disabled' in node.props,
    {deep: false},
  );
  for (const row of rows) {
    const [title, description] = row
      .findAll(node => String(node.type) === 'Text')
      .map(node => [node.props.children].flat().join(''));
    credits.set(title, {description, press: () => row.props.onPress()});
  }
  expect(credits.size).toBeGreaterThan(10);
  return credits;
}

async function linkOf(credit: {press: () => void} | undefined) {
  if (!credit) throw new Error('no such credit');
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await act(async () => credit.press());
  const url = open.mock.calls[0]?.[0];
  open.mockRestore();
  return url;
}

describe('Credits, in English', () => {
  it('credits the corpus, not the treebank, for the morphology', async () => {
    const credits = await render('en');
    expect(credits.get('The Quranic Treebank')?.description).toMatch(
      /NoorBayan \(MIT\)\. Its morphology .*Quranic Arabic Corpus \(GNU GPL\)/,
    );
    expect(credits.get('Quranic Arabic Corpus')?.description).toMatch(
      /GNU GPL, with the corpus's terms of use/,
    );
  });

  it('credits the corpus for the word and root search too', async () => {
    // The search index keeps its proclitic segmentation, roots and lemmas.
    const credits = await render('en');
    expect(credits.get('Quranic Arabic Corpus')?.description).toMatch(
      /^Morphology behind the i'rab and the Quran word and root search \(/,
    );
  });

  it('credits KFGQPC for the riwayah texts and the Uthmani font', async () => {
    const credits = await render('en');
    const kfgqpc = credits.get("King Fahd Glorious Qur'an Printing Complex");
    expect(kfgqpc?.description).toMatch(
      /Warsh, Qalun, al-Bazzi, Qunbul, al-Duri, al-Susi and Shu'bah/,
    );
    expect(await linkOf(kfgqpc)).toBe('https://qurancomplex.gov.sa');
    const font = credits.get('Uthmani Font');
    expect(font?.description).toMatch(/King Fahd Glorious Qur'an/);
    expect(await linkOf(font)).toBe('https://qurancomplex.gov.sa');
  });
});

describe('Credits, in Arabic', () => {
  it('keeps the Latin digits of licence names', async () => {
    const credits = await render('ar');
    expect(credits.get('MASAQ')?.description).toContain('CC BY 4.0');
    expect(credits.get('Wikipedia contributors')?.description).toContain(
      'CC BY-SA 4.0',
    );
    // CC BY 3.0 asks for the licence or its URI with each copy of the text.
    expect(credits.get('Tanzil Quran Text')?.description).toContain(
      'CC BY 3.0: https://creativecommons.org/licenses/by/3.0/',
    );
  });

  it("spells the MASAQ author's family name as he does", async () => {
    // As his university's pages write it; the line had two letters wrong.
    const credits = await render('ar');
    const masaq = credits.get('MASAQ')?.description;
    expect(masaq).not.toContain('لسوالمة');
    expect(masaq).toMatch(/ وزملائه، الجامعة الأردنية /);
  });

  it('credits the corpus for the morphology inside the treebank', async () => {
    const credits = await render('ar');
    expect(credits.get('The Quranic Treebank')?.description).toContain(
      'وتحليله الصرفي من المدونة القرآنية العربية',
    );
  });

  it('credits the corpus for the word and root search too', async () => {
    const credits = await render('ar');
    expect(credits.get('Quranic Arabic Corpus')?.description).toMatch(
      /^التحليل الصرفي الذي بُني عليه الإعراب والبحث في القرآن بالكلمة والجذر \(/,
    );
  });

  it('names KFGQPC in Arabic', async () => {
    const credits = await render('ar');
    expect(credits.has('مجمع الملك فهد لطباعة المصحف الشريف')).toBe(true);
  });
});
