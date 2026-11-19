// @ai-generated
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import i18n from 'i18next';

jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'ar'}],
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: true,
      colors: {
        text: '#eeeeee',
        textSecondary: '#aaaaaa',
        primary: '#5ad1a5',
        background: '#111111',
      },
    },
  }),
}));

import {currentLanguage} from '@/i18n/language';
import {GharibSection} from '../GharibSection';
import {RasmSection} from '../RasmSection';
import {
  allText,
  entry,
  hadhf,
  unit,
  wordTextOf,
} from '../__fixtures__/sections';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const FSI = '\u2068';
const PDI = '\u2069';

let renderer: TestRenderer.ReactTestRenderer | null = null;
function textOf(element: Parameters<typeof TestRenderer.create>[0]): string {
  const made: {tree?: TestRenderer.ReactTestRenderer} = {};
  act(() => {
    made.tree = TestRenderer.create(element);
  });
  if (!made.tree) throw new Error('nothing rendered');
  renderer = made.tree;
  return allText(made.tree.toJSON());
}

beforeAll(async () => {
  await i18n.changeLanguage('ar');
});
afterAll(async () => {
  await i18n.changeLanguage('en');
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('runs in Arabic', () => {
  expect(currentLanguage).toBe('ar');
});

it('shows the gharib section in Arabic, with the Arabic source', () => {
  const text = textOf(
    <GharibSection
      entries={[entry(2, [2, 3], 'يوم الجزاء.')]}
      position={2}
      wordTextOf={wordTextOf}
    />,
  );
  expect(text).toContain('معنى الكلمة');
  expect(text).toContain('«يَوْمِ ٱلدِّينِ» يوم الجزاء.');
  expect(text).toContain(`النص من ${FSI}ناشر${PDI}.`);
});

it('shows the rasm section in Arabic, letters isolated', () => {
  const text = textOf(
    <RasmSection
      rasm={unit([
        hadhf,
        {kind: 'badal', standard: 'ا', mushaf: 'و', mark: null, basis: 'sign'},
      ])}
      uthmani="مَـٰلِكِ"
    />,
  );
  expect(text).toContain('الرسم');
  expect(text).toContain('العثمانيمَـٰلِكِ');
  expect(text).toContain('الإملائيمَالِكِ');
  expect(text).toContain(`الحذف: حُذفت ${FSI}«ا»${PDI} في رسم المصحف.`);
  expect(text).toContain(
    `البدل: رُسمت ${FSI}«ا»${PDI} في المصحف على صورة ${FSI}«و»${PDI}.`,
  );
  expect(text).toContain(`الرسم الإملائي من ${FSI}مشروع النص${PDI}.`);
});
