// @ai-generated
/**
 * The Share screen of the verse actions sheet.
 *
 * Share Link: a verse link (/quran/<surah>/<ayah>) opens one verse; the URL
 * scheme has no ranges. The message sent with it cites that verse, not the
 * whole selection.
 *
 * Fixtures use placeholder words with real verse markers (U+06DD +
 * Arabic-Indic digits) rather than Quran text.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Share} from 'react-native';
import type {RewayahId} from '@/store/mushafSettingsStore';

jest.mock('@shopify/react-native-skia', () => ({
  useCanvasRef: () => ({current: null}),
}));
jest.mock('@/components/share/ShareCardPreview', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/share/captureShareCard', () => ({
  captureShareCard: jest.fn(),
}));
jest.mock('expo-sharing', () => ({shareAsync: jest.fn()}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {quranCommonTypeface: null},
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackShareCreated: jest.fn()},
}));
jest.mock('@/utils/haptics', () => ({lightHaptics: jest.fn()}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#ffffff',
      },
    },
    isDarkMode: false,
  }),
}));

jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  return {
    ScrollView: (props: {children?: React.ReactNode}) =>
      ReactActual.createElement(View, null, props.children),
    SheetManager: {hideAll: jest.fn()},
  };
});

// The real verse URL builder; only the native share call is replaced.
jest.mock('@/utils/shareUtils', () => ({
  ...jest.requireActual('@/utils/shareUtils'),
  shareUrl: jest.fn(async () => undefined),
}));

// Translations per verse key for the selected translation ('' = none).
const mockTranslations = new Map<string, string>();
jest.mock('@/utils/translationLookup', () => ({
  getTranslationTextRaw: (verseKey: string) =>
    mockTranslations.get(verseKey) ?? '',
}));

// Hafs is the active mushaf rewayah; Warsh words sit in a side cache. Both
// are in memory, so the text is ready at once.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const slots = (prefix: string, ayah: number, marker: string) => [
    `${prefix}-${ayah}a`,
    `${prefix}-${ayah}b`,
    marker,
  ];
  const verses = (prefix: string): Map<string, string[]> =>
    new Map([
      ['1:1', slots(prefix, 1, '۝١')],
      ['2:255', slots(prefix, 255, '۝٢٥٥')],
      ['2:256', slots(prefix, 256, '۝٢٥٦')],
      ['2:257', slots(prefix, 257, '۝٢٥٧')],
      ['2:286', slots(prefix, 286, '۝٢٨٦')],
      ['3:1', slots(prefix, 1, '۝١')],
      ['3:2', slots(prefix, 2, '۝٢')],
    ]);
  const byRewayah = new Map([
    ['hafs', verses('HAFS')],
    ['warsh', verses('WARSH')],
  ]);
  const service = {
    rewayah: 'hafs',
    isRewayahReady: (rewayah: string) => byRewayah.has(rewayah),
    getRewayahLoadState: (rewayah: string) =>
      byRewayah.has(rewayah) ? 'ready' : 'idle',
    getVerseText: (verseKey: string, rewayah?: string) =>
      (byRewayah.get(rewayah ?? 'hafs')?.get(verseKey) ?? []).join(' '),
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    ensureRewayahLoaded: jest.fn(async () => undefined),
  };
  return {digitalKhattDataService: service};
});

import {ShareContent} from '../ShareContent';
import {shareUrl} from '@/utils/shareUtils';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = 'https://app.thebayaan.com';

let renderer: TestRenderer.ReactTestRenderer | null = null;
let shareSpy: jest.SpyInstance;

/** Opens the Share screen for `verseKeys` (the first one is the sheet's). */
function open(verseKeys: string[], rewayah: RewayahId) {
  const [surah, ayah] = verseKeys[0].split(':').map(Number);
  act(() => {
    renderer = TestRenderer.create(
      <ShareContent
        verseKey={verseKeys[0]}
        surahNumber={surah}
        ayahNumber={ayah}
        verseKeys={verseKeys.length > 1 ? verseKeys : undefined}
        rewayah={rewayah}
        onDone={() => undefined}
      />,
    );
  });
}

async function press(label: string) {
  if (!renderer) throw new Error('nothing rendered');
  const target = renderer.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    )
    .pop();
  if (!target) throw new Error(`nothing to press for ${label}`);
  await act(async () => {
    await target.props.onPress();
  });
}

beforeEach(() => {
  mockTranslations.clear();
  (shareUrl as jest.Mock).mockClear();
  shareSpy = jest
    .spyOn(Share, 'share')
    .mockImplementation(async () => ({action: 'sharedAction'}));
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  shareSpy.mockRestore();
});

describe('Share Link', () => {
  it('cites the one verse the link opens for a multi-verse selection', async () => {
    open(['2:255', '2:256', '2:257'], 'warsh');
    await press('Share Link');
    expect(shareUrl).toHaveBeenCalledWith(
      `${BASE}/quran/2/255?theme=light&rewayah=warsh`,
      'Quran Al-Baqarah 2:255 · Warsh',
    );
  });

  it('cites the first verse of a selection across two surahs', async () => {
    open(['2:286', '3:1', '3:2'], 'hafs');
    await press('Share Link');
    expect(shareUrl).toHaveBeenCalledWith(
      `${BASE}/quran/2/286?theme=light`,
      'Quran Al-Baqarah 2:286',
    );
  });

  it.each<[RewayahId, string, string]>([
    ['hafs', `${BASE}/quran/2/255?theme=light`, 'Quran Al-Baqarah 2:255'],
    [
      'warsh',
      `${BASE}/quran/2/255?theme=light&rewayah=warsh`,
      'Quran Al-Baqarah 2:255 · Warsh',
    ],
  ])('a single verse is unchanged (%s)', async (rewayah, url, message) => {
    open(['2:255'], rewayah);
    await press('Share Link');
    expect(shareUrl).toHaveBeenCalledWith(url, message);
  });
});
