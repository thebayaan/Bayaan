import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {SheetProps} from 'react-native-actions-sheet';
import type {PracticeTarget} from '@/services/recitation/practice/types';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
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
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111111', textSecondary: '#555555', background: '#fff'},
      isDarkMode: false,
    },
  }),
}));
const mockPractice = {
  start: jest.fn(async (_target: unknown) => undefined),
  stop: jest.fn(async () => undefined),
};
jest.mock('@/services/recitation/practice/PracticeService', () => ({
  startPractice: (target: unknown) => mockPractice.start(target),
  stopPractice: () => mockPractice.stop(),
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({mushafRenderer: 'dk_v2', arabicTextWeight: 'normal'}),
  getDkFontFamily: () => 'DigitalKhatt',
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({}),
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => {
    const {Text: MockText} = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: ({verseKey}: {verseKey: string}) => (
        <MockText testID="verse-text">{verseKey}</MockText>
      ),
    };
  },
);
jest.mock('react-native-actions-sheet', () => {
  const {ScrollView} = jest.requireActual('react-native');
  return {
    ScrollView,
    SheetManager: {hide: jest.fn(async () => undefined)},
  };
});

import {PRACTICE_IDLE, usePracticeStore} from '@/store/practiceStore';
import {RecitationPracticeSheet} from '../RecitationPracticeSheet';

const TARGET: PracticeTarget = {
  expected: {surah: 18, ayah: 5, ayahEnd: 5},
  mode: 'correction',
};

let renderer: TestRenderer.ReactTestRenderer | null = null;

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  await act(async () => {
    renderer = TestRenderer.create(
      <RecitationPracticeSheet
        {...({
          sheetId: 'recitation-practice',
          payload: {target: TARGET},
        } as unknown as SheetProps<'recitation-practice'>)}
      />,
    );
  });
  return renderer!;
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
  usePracticeStore.setState(PRACTICE_IDLE);
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = null;
});

describe('RecitationPracticeSheet', () => {
  it('starts practising the target when it opens, with the ayah hidden', async () => {
    const r = await render();
    expect(mockPractice.start).toHaveBeenCalledWith(TARGET);
    expect(texts(r)).toContain('Al-Kahf · ayah 5');
    expect(texts(r)).not.toContain('18:5');
    await act(async () => {
      button(r, 'Show the ayah').props.onPress();
    });
    expect(texts(r)).toContain('18:5');
  });

  it('a clean verdict says so', async () => {
    usePracticeStore.setState({
      ...PRACTICE_IDLE,
      status: 'done',
      target: TARGET,
      verdict: {outcome: 'clean', flags: [], recited: []},
    });
    const r = await render();
    expect(texts(r)).toContain('Clean this time.');
  });

  it('a flagged verdict lists what is still worth checking', async () => {
    usePracticeStore.setState({
      ...PRACTICE_IDLE,
      status: 'done',
      target: TARGET,
      verdict: {
        outcome: 'flagged',
        flags: [
          {
            kind: 'skippedWord',
            surah: 18,
            ayah: 5,
            word: 2,
            key: 'skippedWord:18:5:2',
          },
        ],
        recited: [],
      },
    });
    const r = await render();
    expect(texts(r)).toEqual(
      expect.arrayContaining([
        'Still worth checking:',
        'Al-Kahf · ayah 5: A word here may have been skipped.',
      ]),
    );
  });

  it('Try again starts the same practice again', async () => {
    usePracticeStore.setState({
      ...PRACTICE_IDLE,
      status: 'done',
      target: TARGET,
      verdict: {outcome: 'nothing', flags: [], recited: []},
    });
    const r = await render();
    mockPractice.start.mockClear();
    await act(async () => {
      button(r, 'Try again').props.onPress();
    });
    expect(mockPractice.start).toHaveBeenCalledWith(TARGET);
  });

  it('closing the sheet stops practice', async () => {
    const r = await render();
    await act(async () => r.unmount());
    renderer = null;
    expect(mockPractice.stop).toHaveBeenCalled();
  });
});
