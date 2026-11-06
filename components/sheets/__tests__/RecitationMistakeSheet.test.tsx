import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {SheetProps} from 'react-native-actions-sheet';
import type {WordMark} from '@/services/recitation/wordMarks';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

jest.mock('@/components/sheets/AdaptiveActionSheet', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
      <MockView testID="sheet">{children}</MockView>
    ),
    useSheetWidth: () => 390,
  };
});
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => ({__esModule: true, default: () => null}),
);
jest.mock('@/hooks/useMushafFontMgr', () => ({useMushafFontMgr: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111111', textSecondary: '#555555', background: '#fff'},
      isDarkMode: false,
    },
  }),
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (select: (s: object) => unknown) =>
    select({mushafRenderer: 'dk_v1', arabicTextWeight: 'normal'}),
  getDkFontFamily: () => 'dk',
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getVerseWords: () =>
      [1, 2, 3, 4].map(p => ({
        verseKey: '67:12',
        wordPositionInVerse: p,
        text: 'w',
      })),
    getPageForVerse: () => 563,
  },
}));
const mockService = {
  hold: jest.fn(() => true),
  release: jest.fn(),
  dismiss: jest.fn(async (_mark: unknown) => undefined),
};
jest.mock('@/services/recitation/RecitationTrackingService', () => ({
  holdRecitationTracking: () => mockService.hold(),
  releaseRecitationTracking: () => mockService.release(),
  dismissRecitationMark: (mark: unknown) => mockService.dismiss(mark),
}));
const mockPlayer = {
  rewayatId: 'r1' as string | null,
  setRange: jest.fn(),
  setVerseRepeatCount: jest.fn(),
  setRangeRepeatCount: jest.fn(),
  startPlayback: jest.fn(async () => undefined),
};
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {getState: () => mockPlayer, setState: jest.fn()},
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hide: jest.fn(async () => undefined), show: jest.fn()},
}));

import {RecitationMistakeSheet} from '../RecitationMistakeSheet';

const MARK: WordMark = {
  surah: 67,
  ayah: 12,
  word: 2,
  totalWords: 4,
  kind: 'missed',
  status: 'mistake',
  since: 0,
};

async function render(mark: WordMark) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <RecitationMistakeSheet
        {...({
          sheetId: 'recitation-mistake',
          payload: {mark},
        } as unknown as SheetProps<'recitation-mistake'>)}
      />,
    );
  });
  return renderer;
}

function texts(r: TestRenderer.ReactTestRenderer): string[] {
  return r.root
    .findAll(n => (n.type as unknown) === Text)
    .map(n => [n.props.children].flat().join(''));
}

function button(r: TestRenderer.ReactTestRenderer, label: string) {
  return r.root.find(
    n =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n
        .findAll(m => (m.type as unknown) === Text)
        .some(m => [m.props.children].flat().join('') === label),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.rewayatId = 'r1';
});

describe('RecitationMistakeSheet', () => {
  it('says what may have happened, and where', async () => {
    const r = await render(MARK);
    expect(texts(r)).toContain('You may have missed this word.');
    // The engine's word 2 is the ayah's 3rd word.
    expect(texts(r)).toContain('Al-Mulk · ayah 12 · word 3');
  });

  it('holds the recitation while open and lets it go when closed', async () => {
    const r = await render(MARK);
    expect(mockService.hold).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
    expect(mockService.release).toHaveBeenCalledTimes(1);
  });

  it('"I read it correctly" removes the mark', async () => {
    const r = await render(MARK);
    await act(async () => {
      await button(r, 'I read it correctly').props.onPress();
    });
    expect(mockService.dismiss).toHaveBeenCalledWith(MARK);
  });

  it('Listen plays just this ayah with the mushaf reciter', async () => {
    const r = await render(MARK);
    await act(async () => {
      await button(r, 'Listen to this ayah').props.onPress();
    });
    expect(mockPlayer.setRange).toHaveBeenCalledWith(
      {surah: 67, ayah: 12},
      {surah: 67, ayah: 12},
    );
    expect(mockPlayer.startPlayback).toHaveBeenCalledWith(563, '67:12');
  });

  it('a corrected word says so, with nothing to dismiss', async () => {
    const r = await render({...MARK, status: 'corrected'});
    expect(texts(r)).toContain('You went back and recited it correctly.');
    expect(texts(r)).not.toContain('I read it correctly');
  });
});
