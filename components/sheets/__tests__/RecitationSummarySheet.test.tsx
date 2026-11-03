import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {SheetProps} from 'react-native-actions-sheet';
import type {RecitationSummary} from '@/store/recitationTrackingStore';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
      <MockView testID="sheet">{children}</MockView>
    ),
  };
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111111', textSecondary: '#555555', background: '#fff'},
      isDarkMode: false,
    },
  }),
}));
const mockLog = {dismiss: jest.fn(async (_flag: unknown) => undefined)};
jest.mock('@/services/recitation/RecitationLogDatabase', () => ({
  recitationLogDatabase: {dismiss: (flag: unknown) => mockLog.dismiss(flag)},
}));
const mockNavigate = jest.fn();
jest.mock('@/store/mushafNavigationStore', () => ({
  useMushafNavigationStore: {
    getState: () => ({navigateToVerse: mockNavigate}),
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {getPageForVerse: () => 293},
}));
const mockSheets = {show: jest.fn()};
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    hide: jest.fn(async () => undefined),
    show: (id: string, options: unknown) => mockSheets.show(id, options),
  },
}));

import {RecitationSummarySheet} from '../RecitationSummarySheet';

const SUMMARY: RecitationSummary = {
  takeId: 'take-1',
  startedAt: 0,
  endedAt: 60_000,
  ayat: [
    {surah: 18, ayah: 3},
    {surah: 18, ayah: 4},
    {surah: 18, ayah: 6},
  ],
  flags: [
    {
      kind: 'skippedAyah',
      surah: 18,
      ayah: 5,
      word: 0,
      key: 'skippedAyah:18:5:0',
    },
    {
      kind: 'skippedWord',
      surah: 18,
      ayah: 6,
      word: 2,
      key: 'skippedWord:18:6:2',
    },
  ],
};

async function render(
  summary: RecitationSummary,
): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <RecitationSummarySheet
        {...({
          sheetId: 'recitation-summary',
          payload: {summary},
        } as unknown as SheetProps<'recitation-summary'>)}
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

function buttons(r: TestRenderer.ReactTestRenderer, label: string) {
  return r.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n
        .findAll(m => (m.type as unknown) === Text)
        .some(m => [m.props.children].flat().join('') === label),
  );
}

beforeEach(() => jest.clearAllMocks());

describe('RecitationSummarySheet', () => {
  it('shows the ayat recited and each possible slip in its own words', async () => {
    const r = await render(SUMMARY);
    const shown = texts(r);
    expect(shown).toContain('Al-Kahf · ayat 3–6');
    expect(shown).toContain('You may have skipped this ayah.');
    expect(shown).toContain('A word here may have been skipped.');
    expect(shown).toContain(
      'These are possible slips the phone heard. It does not check tajweed or harakat; a teacher does.',
    );
  });

  it('says so when there is nothing to check', async () => {
    const r = await render({...SUMMARY, flags: []});
    expect(texts(r)).toContain('Nothing to check this time.');
  });

  it('I read it correctly removes the row and remembers it', async () => {
    const r = await render(SUMMARY);
    await act(async () => {
      await buttons(r, 'I read it correctly')[0].props.onPress();
    });
    expect(mockLog.dismiss).toHaveBeenCalledWith(SUMMARY.flags[0]);
    expect(texts(r)).not.toContain('You may have skipped this ayah.');
    expect(texts(r)).toContain('A word here may have been skipped.');
  });

  it('Show opens the ayah in the mushaf', async () => {
    const r = await render(SUMMARY);
    await act(async () => {
      await buttons(r, 'Show')[1].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('18:6', 293);
  });

  it('Retry opens a practice take on that ayah', async () => {
    const r = await render(SUMMARY);
    await act(async () => {
      await buttons(r, 'Retry')[0].props.onPress();
    });
    expect(mockSheets.show).toHaveBeenCalledWith('recitation-practice', {
      payload: {
        target: expect.objectContaining({
          expected: {surah: 18, ayah: 5, ayahEnd: 5},
          mode: 'correction',
        }),
      },
    });
  });
});
