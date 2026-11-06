import React from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {SheetProps} from 'react-native-actions-sheet';

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
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111111', textSecondary: '#555555', background: '#fff'},
      isDarkMode: false,
    },
  }),
}));
const mockIdentify = {
  startAyahIdentify: jest.fn(async () => undefined),
  stopAyahIdentify: jest.fn(async () => undefined),
};
// Factories run when the sheet is imported, before these consts are set, so
// they read the mocks lazily.
jest.mock('@/services/recitation/identify/AyahIdentifyService', () => ({
  startAyahIdentify: () => mockIdentify.startAyahIdentify(),
  stopAyahIdentify: () => mockIdentify.stopAyahIdentify(),
}));
const mockModel = {needsDownload: false};
jest.mock('@/services/recitation/engineHost', () => ({
  recitationModelNeedsDownload: async () => mockModel.needsDownload,
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {getPageForVerse: () => 531},
}));
const mockSettings = {
  rewayah: 'hafs',
  mushafRenderer: 'dk_v2',
  arabicTextWeight: 'normal',
};
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (selector: (s: unknown) => unknown) =>
    selector(mockSettings),
  getDkFontFamily: () => 'DigitalKhatt',
}));
const mockMushafPlayer = {
  rewayatId: 'mushaf-reciter-rewayah' as string | null,
  setRange: jest.fn(),
  setVerseRepeatCount: jest.fn(),
  setRangeRepeatCount: jest.fn(),
  startPlayback: jest.fn(async () => undefined),
};
const mockSetMushafPlayer = jest.fn();
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {
    getState: () => mockMushafPlayer,
    setState: (patch: unknown) => mockSetMushafPlayer(patch),
  },
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
const mockRouter = {push: jest.fn()};
jest.mock('expo-router', () => ({
  router: {push: (route: unknown) => mockRouter.push(route)},
}));
const mockSheets = {show: jest.fn()};
jest.mock('react-native-actions-sheet', () => {
  const {ScrollView} = jest.requireActual('react-native');
  return {
    ScrollView,
    SheetManager: {
      hide: jest.fn(async () => undefined),
      show: (id: string, options: unknown) => mockSheets.show(id, options),
    },
  };
});

import {
  useAyahIdentifyStore,
  AYAH_IDENTIFY_IDLE,
} from '@/store/ayahIdentifyStore';
import {WhichAyahSheet} from '../WhichAyahSheet';

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <WhichAyahSheet
        {...({sheetId: 'which-ayah'} as SheetProps<'which-ayah'>)}
      />,
    );
  });
  return renderer;
}

/** Every string rendered in a Text, in order. */
function texts(r: TestRenderer.ReactTestRenderer): string[] {
  return r.root
    .findAll(n => (n.type as unknown) === Text)
    .map(n => [n.props.children].flat().join(''));
}

function button(r: TestRenderer.ReactTestRenderer, label: string) {
  return r.root.find(
    n =>
      typeof n.props.onPress === 'function' &&
      n
        .findAll(m => (m.type as unknown) === Text)
        .some(m => [m.props.children].flat().join('') === label) &&
      !n.parent?.props?.onPress,
  );
}

function showFound(): void {
  useAyahIdentifyStore.setState({
    ...AYAH_IDENTIFY_IDLE,
    status: 'found',
    micOn: true,
    match: {surah: 55, ayah: 13},
    current: {surah: 55, ayah: 13},
    twins: ['55:16', '55:18', '55:21', '55:23', '55:25'],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockModel.needsDownload = false;
  mockSettings.rewayah = 'hafs';
  mockMushafPlayer.rewayatId = 'mushaf-reciter-rewayah';
  useAyahIdentifyStore.setState(AYAH_IDENTIFY_IDLE);
});

describe('WhichAyahSheet', () => {
  it('starts listening at once when the model is already downloaded', async () => {
    await render();
    expect(mockIdentify.startAyahIdentify).toHaveBeenCalledTimes(1);
  });

  it('asks before the first download', async () => {
    mockModel.needsDownload = true;
    const r = await render();
    expect(mockIdentify.startAyahIdentify).not.toHaveBeenCalled();
    await act(async () => {
      button(r, 'Allow microphone and download').props.onPress();
    });
    expect(mockIdentify.startAyahIdentify).toHaveBeenCalledTimes(1);
  });

  it('shows the found ayah with its surah and the places worded the same', async () => {
    showFound();
    const r = await render();
    const shown = texts(r);
    expect(shown).toContain('Ar-Rahman · Ayah 13');
    expect(shown).toContain('55:13');
    expect(shown).toContain('The same words are also at');
    expect(shown).toEqual(
      expect.arrayContaining(['55:16', '55:18', '55:21', '+2']),
    );
    expect(shown).toContain('Following the recitation');
  });

  it('Open in mushaf stops listening and opens the mushaf at the ayah', async () => {
    showFound();
    const r = await render();
    await act(async () => {
      await button(r, 'Open in mushaf').props.onPress();
    });
    expect(mockIdentify.stopAyahIdentify).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: {surah: '55', ayah: '13', page: '531'},
    });
  });

  it('Play from here starts the mushaf player at the ayah, to the end of the surah', async () => {
    showFound();
    const r = await render();
    await act(async () => {
      await button(r, 'Play from Here').props.onPress();
    });
    expect(mockMushafPlayer.setRange).toHaveBeenCalledWith(
      {surah: 55, ayah: 13},
      {surah: 55, ayah: 78},
    );
    expect(mockMushafPlayer.startPlayback).toHaveBeenCalledWith(531, '55:13');
  });

  it('no Play from here over a non-Hafs rewayah', async () => {
    mockSettings.rewayah = 'warsh';
    showFound();
    const r = await render();
    expect(texts(r)).not.toContain('Play from Here');
    expect(texts(r)).toContain('Open in mushaf');
  });

  it('closing the sheet stops identify', async () => {
    const r = await render();
    await act(async () => {
      r.unmount();
    });
    expect(mockIdentify.stopAyahIdentify).toHaveBeenCalled();
  });

  it('listening that stopped by itself offers to listen again', async () => {
    useAyahIdentifyStore.setState({...AYAH_IDENTIFY_IDLE, status: 'stopped'});
    const r = await render();
    expect(texts(r)).toContain('Listening stopped.');
    mockIdentify.startAyahIdentify.mockClear();
    await act(async () => {
      button(r, 'Listen again').props.onPress();
    });
    expect(mockIdentify.startAyahIdentify).toHaveBeenCalledTimes(1);
  });

  it('Play from here without a mushaf reciter asks for one first', async () => {
    mockMushafPlayer.rewayatId = null;
    showFound();
    const r = await render();
    await act(async () => {
      await button(r, 'Play from Here').props.onPress();
    });
    expect(mockMushafPlayer.startPlayback).not.toHaveBeenCalled();
    expect(mockSetMushafPlayer).toHaveBeenCalledWith({
      currentPage: 531,
      pendingStartVerseKey: '55:13',
    });
    expect(mockSheets.show).toHaveBeenCalledWith('mushaf-player-options', {
      payload: {currentPage: 531},
    });
  });

  it('a long ayah scrolls in a bounded box, so the buttons stay on screen', async () => {
    showFound();
    const r = await render();
    let node = r.root.findByProps({testID: 'verse-text'}).parent;
    while (node && (node.type as unknown) !== ScrollView) node = node.parent;
    expect(node).toBeTruthy();
    const style = StyleSheet.flatten(node?.props.style);
    expect(style.maxHeight).toBeGreaterThan(0);
  });
});
