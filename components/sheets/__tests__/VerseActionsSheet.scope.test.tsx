const mockSheetHide = jest.fn(async (..._args: unknown[]) => undefined);
const mockSheetShow = jest.fn((..._args: unknown[]) => undefined);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-actions-sheet', () => {
  const React = require('react');
  const {View, ScrollView} = require('react-native');
  return {
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) =>
      React.createElement(View, null, children),
    ScrollView,
    SheetManager: {
      hide: (...args: unknown[]) => mockSheetHide(...args),
      hideAll: (...args: unknown[]) => mockSheetHide(...args),
      show: (...args: unknown[]) => mockSheetShow(...args),
    },
  };
});

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#fff',
        text: '#111',
        textSecondary: '#555',
        border: '#ddd',
      },
    },
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
}));

jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  RepeatIcon: () => null,
  StackedVolumesIcon: () => null,
  PageQuillIcon: () => null,
  MirrorWavesIcon: () => null,
  HighlightIcon: () => null,
  ChainLinksIcon: () => null,
  GroupedLinesIcon: () => null,
  BreakdownIcon: () => null,
  CopyIcon: () => null,
  ShareIcon: () => null,
}));

jest.mock('@/utils/haptics', () => ({lightHaptics: jest.fn()}));
jest.mock('@/utils/translationLookup', () => ({
  getTranslationTextRaw: () => '',
}));
jest.mock('expo-clipboard', () => ({setStringAsync: jest.fn()}));
jest.mock('expo-router', () => ({router: {push: jest.fn()}}));

jest.mock('@/services/mushaf/QulDataService', () => ({
  qulDataService: {
    hasSimilarVerses: async () => false,
    hasSharedPhrases: async () => false,
  },
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getVerseText: () => '',
    getPageForVerse: () => 1,
  },
}));

const mockMushafSettingsState = {
  selectedTranslationId: 'en-test',
  rewayah: 'hafs',
};
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: Object.assign(
    (selector: (state: typeof mockMushafSettingsState) => unknown) =>
      selector(mockMushafSettingsState),
    {getState: () => mockMushafSettingsState},
  ),
}));

const mockNoopStore = {
  clearSelection: jest.fn(),
  currentPage: 1,
  rewayatId: null,
};
jest.mock('@/store/verseSelectionStore', () => ({
  useVerseSelectionStore: {getState: () => mockNoopStore},
}));
jest.mock('@/store/mushafVerseSelectionStore', () => ({
  useMushafVerseSelectionStore: {getState: () => mockNoopStore},
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {getState: () => mockNoopStore, setState: jest.fn()},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {tracks: [], currentIndex: 0},
      playback: {state: 'idle'},
      setSheetMode: jest.fn(),
    }),
  },
}));
jest.mock('@/store/timestampStore', () => ({
  useTimestampStore: {
    getState: () => ({
      supportedRewayatIds: new Set(),
      currentSurahTimestamps: [],
      setCurrentAyah: jest.fn(),
    }),
  },
}));

jest.mock('../verse-actions/HighlightContent', () => ({
  HighlightContent: () => null,
}));
jest.mock('../verse-actions/NoteContent', () => ({NoteContent: () => null}));
jest.mock('../verse-actions/ShareContent', () => ({ShareContent: () => null}));
jest.mock('../verse-actions/SimilarVersesContent', () => ({
  SimilarVersesContent: () => null,
}));
jest.mock('../verse-actions/TranslationContent', () => ({
  TranslationContent: () => null,
}));
jest.mock('../verse-actions/TafseerContent', () => ({
  TafseerContent: () => null,
}));
jest.mock('../verse-actions/ThemeContent', () => ({ThemeContent: () => null}));
jest.mock('../verse-actions/WBWContent', () => ({WBWContent: () => null}));

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {VerseActionsSheet} from '../VerseActionsSheet';
import {qfSyncDatabaseService} from '@/services/sync/qfSyncDatabaseService';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';

function bookmarkResult(accountId: string, verseKey: string) {
  const [surahNumber, ayahNumber] = verseKey.split(':').map(Number);
  return {
    id: `${accountId}-${verseKey}`,
    ownerScope: `qf:${accountId}` as const,
    verseKey,
    surahNumber,
    ayahNumber,
    createdAt: 7001,
    rewayahId: 'hafs' as const,
  };
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockSheetHide.mockClear();
  mockSheetShow.mockClear();
  useQfSyncStore.getState().resetForTesting();
  useQfSyncStore.setState({activeAccountId: 'account-a'});
  useVerseAnnotationsStore.getState().clearActiveView();
});

// @ai-start
it.each([true, false])(
  'dismisses failed bookmark persistence only in the original scope (current=%s)',
  async scopeCurrent => {
    let reject!: (error: Error) => void;
    const accountAdd = jest
      .spyOn(qfSyncDatabaseService, 'addBookmark')
      .mockImplementation(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          }),
      );
    const errorLog = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    let screen!: renderer.ReactTestRenderer;
    await act(async () => {
      screen = renderer.create(
        <VerseActionsSheet
          sheetId="verse-actions"
          payload={{verseKey: '2:255', surahNumber: 2, ayahNumber: 255}}
        />,
      );
    });
    let button = screen.root.findByProps({children: 'Bookmark'});
    while (button.parent && typeof button.props.onPress !== 'function')
      button = button.parent;
    let action!: Promise<void>;
    await act(async () => {
      action = button.props.onPress();
      await Promise.resolve();
    });
    expect(accountAdd).toHaveBeenCalledTimes(1);
    if (!scopeCurrent)
      await act(async () =>
        useQfSyncStore.setState({activeAccountId: 'account-b'}),
      );
    mockSheetHide.mockClear(); // Ignore the scope hook's earlier dismissal.
    await act(async () => {
      reject(new Error('disk write failed'));
      await action;
    });
    expect(mockSheetHide).toHaveBeenCalledTimes(scopeCurrent ? 1 : 0);
    expect(useVerseAnnotationsStore.getState().isBookmarked('2:255')).toBe(
      false,
    );
    expect(errorLog).toHaveBeenCalledWith(
      '[VerseActionsSheet] Bookmark toggle failed:',
      expect.any(Error),
    );
    await act(async () => screen.unmount());
  },
);
// @ai-end

it('rejects a retained bookmark press after its opening account changes', async () => {
  const accountAdd = jest.spyOn(qfSyncDatabaseService, 'addBookmark');
  let screen!: renderer.ReactTestRenderer;
  await act(async () => {
    screen = renderer.create(
      <VerseActionsSheet
        sheetId="verse-actions"
        payload={{verseKey: '2:255', surahNumber: 2, ayahNumber: 255}}
      />,
    );
  });
  const label = screen.root.findByProps({children: 'Bookmark'});
  if (!label.parent) throw new Error('bookmark action missing');
  let button = label.parent;
  while (button.parent && typeof button.props.onPress !== 'function')
    button = button.parent;
  const retainedPress = button.props.onPress;
  await act(async () =>
    useQfSyncStore.setState({activeAccountId: 'account-b'}),
  );
  await act(async () => retainedPress());
  expect(accountAdd).not.toHaveBeenCalled();
  expect(mockSheetHide).toHaveBeenCalledWith('verse-actions');
  expect(screen.root.findAllByProps({children: 'Bookmark'})).toHaveLength(0);
  await act(async () => screen.unmount());
});

it('keeps a paused bookmark range action in its original account and out of the new view', async () => {
  let finishFirstWrite: (
    value: ReturnType<typeof bookmarkResult>,
  ) => void = () => undefined;
  let call = 0;
  const accountAdd = jest
    .spyOn(qfSyncDatabaseService, 'addBookmark')
    .mockImplementation(async input => {
      call += 1;
      if (call === 1) {
        return new Promise(resolve => {
          finishFirstWrite = resolve;
        });
      }
      return bookmarkResult(input.accountId, input.verseKey);
    });

  let screen: renderer.ReactTestRenderer | null = null;
  await act(async () => {
    screen = renderer.create(
      <VerseActionsSheet
        sheetId="verse-actions"
        payload={{
          verseKey: '2:255',
          surahNumber: 2,
          ayahNumber: 255,
          verseKeys: ['2:255', '2:256'],
        }}
      />,
    );
  });
  const rendered = screen as renderer.ReactTestRenderer | null;
  if (!rendered) throw new Error('verse actions sheet did not render');
  const bookmarkLabel = rendered.root.findByProps({children: 'Bookmark'});
  if (!bookmarkLabel.parent) throw new Error('bookmark action was not found');
  let bookmarkButton = bookmarkLabel.parent;
  while (
    bookmarkButton.parent &&
    typeof bookmarkButton.props.onPress !== 'function'
  ) {
    bookmarkButton = bookmarkButton.parent;
  }

  let rangeAction: Promise<void> = Promise.resolve();
  await act(async () => {
    rangeAction = bookmarkButton.props.onPress();
    await Promise.resolve();
  });
  expect(accountAdd).toHaveBeenCalledTimes(1);
  expect(accountAdd.mock.calls[0][0].accountId).toBe('account-a');

  await act(async () => {
    useQfSyncStore.setState({activeAccountId: 'account-b'});
    useVerseAnnotationsStore.getState().clearActiveView();
    finishFirstWrite(bookmarkResult('account-a', '2:255'));
    await rangeAction;
  });

  expect(accountAdd.mock.calls.map(([input]) => input.accountId)).toEqual([
    'account-a',
    'account-a',
  ]);
  expect(useVerseAnnotationsStore.getState().bookmarkedVerseKeys.size).toBe(0);
  await act(async () => {
    screen?.unmount();
  });
});
