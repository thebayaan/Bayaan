// @ai-generated
/**
 * The Share screen shares the shown rewayah's OWN verses (decision 3): the
 * text is exactly the verses' slots with their own markers, the translation
 * is Hafs-aligned (a divided Hafs verse whole, with a note), the citation is
 * in the rewayah's numbering, and the link names the Hafs verse holding the
 * first selected verse's start (the web reader resolves Hafs verses only)
 * with ?rewayah=. Hafs is shared exactly as before.
 *
 * Warsh units are built from real slots (verseUnitsFixture.json); the Hafs
 * text is a placeholder string per verse.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Share} from 'react-native';

jest.mock('@shopify/react-native-skia', () => ({
  useCanvasRef: () => ({current: null}),
}));
const mockCards: Array<Record<string, unknown>> = [];
function mockCard(props: Record<string, unknown>) {
  mockCards.push(props);
  return null;
}
jest.mock('@/components/share/ShareCardPreview', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockCard(props),
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
jest.mock('@/utils/translationLookup', () => ({
  getTranslationTextRaw: (verseKey: string) => `T(${verseKey})`,
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'hafs',
    isRewayahReady: () => true,
    getRewayahLoadState: () => 'ready',
    getVerseText: (key: string, r?: string) =>
      r === 'hafs' || r === undefined ? `HAFS-${key} ۝` : '',
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    ensureRewayahLoaded: jest.fn(async () => undefined),
  },
  getRewayahDataIdentityKey: (r: string) => `${r}@test`,
}));
const mockUnits = {models: new Map<string, unknown>()};
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: (r: string) => mockUnits.models.get(r) ?? null,
    getStatus: (r: string) => (mockUnits.models.has(r) ? 'ready' : 'error'),
  },
}));

import {ShareContent} from '../ShareContent';
import {shareUrl} from '@/utils/shareUtils';
import {showToast} from '@/utils/toastUtils';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = 'https://app.thebayaan.com';

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: Record<'warsh', string[]>;
  };
function buildWarsh(): RewayahVerseUnits {
  const slots: VerseUnitSlot[] = fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts.warsh[i]};
  });
  return buildRewayahVerseUnits('warsh', slots, 'warsh@test');
}
const warsh = buildWarsh();
const warshText = (key: string) => warsh.unitText(warsh.unitByKey(key)!);
const WARSH_17_NOTE =
  'Translation of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.';

let renderer: TestRenderer.ReactTestRenderer | null = null;
let shareSpy: jest.SpyInstance;

interface Open {
  verseKeys: string[];
  rewayah: RewayahId;
  unitKeys?: string[];
}

/** The Share screen as the verse actions sheet opens it. */
function open({verseKeys, rewayah, unitKeys}: Open) {
  const [surah, ayah] = verseKeys[0].split(':').map(Number);
  act(() => {
    renderer = TestRenderer.create(
      <ShareContent
        verseKey={verseKeys[0]}
        surahNumber={surah}
        ayahNumber={ayah}
        verseKeys={verseKeys.length > 1 ? verseKeys : undefined}
        unitKeys={unitKeys}
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

const sharedMessage = (): string => {
  expect(shareSpy).toHaveBeenCalledTimes(1);
  return shareSpy.mock.calls[0][0].message;
};

beforeEach(() => {
  mockCards.length = 0;
  mockUnits.models = new Map([['warsh', warsh]]);
  jest.clearAllMocks();
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

describe('Hafs (unchanged)', () => {
  it('shares the text, translation and citation as before', async () => {
    open({verseKeys: ['2:255', '2:256'], rewayah: 'hafs'});
    await press('Share as Text');
    expect(sharedMessage()).toBe(
      'HAFS-2:255 ۝ HAFS-2:256 ۝\n\nT(2:255)\nT(2:256)\n\n-- Quran Al-Baqarah 2:255-256',
    );
  });

  it('links the payload verse with no rewayah', async () => {
    open({verseKeys: ['2:255'], rewayah: 'hafs'});
    await press('Share Link');
    expect(shareUrl).toHaveBeenCalledWith(
      `${BASE}/quran/2/255?theme=light`,
      'Quran Al-Baqarah 2:255',
    );
  });

  it('draws the card from the Hafs keys', () => {
    open({verseKeys: ['2:255'], rewayah: 'hafs'});
    expect(mockCards[mockCards.length - 1]).toMatchObject({
      verseKeys: ['2:255'],
      verseTexts: ['HAFS-2:255 ۝'],
      rewayah: 'hafs',
    });
  });
});

describe('Warsh verses in their own numbering', () => {
  it('shares exactly the verse, its paired translation and its own citation', async () => {
    open({verseKeys: ['1:7'], rewayah: 'warsh', unitKeys: ['1:6']});
    await press('Share as Text');
    expect(sharedMessage()).toBe(
      `${warshText('1:6')}\n\nT(1:7)\n${WARSH_17_NOTE}\n\n-- Quran Al-Fatihah 1:6 · Warsh`,
    );
  });

  it('draws the card from the verses themselves', () => {
    open({verseKeys: ['1:7'], rewayah: 'warsh', unitKeys: ['1:7']});
    expect(mockCards[mockCards.length - 1]).toMatchObject({
      verseKeys: ['1:7'],
      verseTexts: [warshText('1:7')],
      rewayah: 'warsh',
    });
  });

  it('links the Hafs verse holding the verse, citing its own number', async () => {
    // Warsh 1:7 starts inside Hafs 1:7 (anchor 1:7:5): the web reader
    // knows Hafs verses only, so the link names Hafs 1:7.
    open({verseKeys: ['1:7'], rewayah: 'warsh', unitKeys: ['1:7']});
    await press('Share Link');
    expect(shareUrl).toHaveBeenCalledWith(
      `${BASE}/quran/1/7?theme=light&rewayah=warsh`,
      'Quran Al-Fatihah 1:7 · Warsh',
    );
  });

  it('a Hafs-keyed request shares the Warsh verses holding the Hafs verses', async () => {
    open({verseKeys: ['103:1', '103:2'], rewayah: 'warsh'});
    await press('Share as Text');
    expect(sharedMessage()).toBe(
      `${warshText('103:1')}\n\nT(103:1)\nT(103:2)\n\n-- Quran Al-'Asr 103:1 · Warsh`,
    );
  });

  it('shares nothing and says why when the Warsh verses cannot be named', async () => {
    mockUnits.models = new Map();
    open({verseKeys: ['1:7'], rewayah: 'warsh', unitKeys: ['1:7']});
    await press('Share as Text');
    await press('Share Link');
    expect(shareSpy).not.toHaveBeenCalled();
    expect(shareUrl).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "Couldn't load the Warsh text",
      'Nothing was shared. Please try again.',
      'error',
    );
  });
});
