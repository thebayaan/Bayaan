// @ai-generated
/**
 * The Share screen of the verse actions sheet.
 *
 * Share Link: a verse link (/quran/<surah>/<ayah>) opens one verse; the URL
 * scheme has no ranges. The message sent with it cites that verse, not the
 * whole selection.
 *
 * Share as Text: the message keeps its layout from before Release 1 (byte
 * for byte for Hafs): Arabic, translation and citation paragraphs, the
 * translation paragraph kept (empty) when the selected translation has no
 * text for the verses.
 *
 * Fixtures use placeholder words with real verse markers (U+06DD +
 * Arabic-Indic digits) rather than Quran text.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Share} from 'react-native';
import type {RewayahId} from '@/store/mushafSettingsStore';

// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../sheetGestures');
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

// @ai-start
// A downloaded translation's rows in the translations database, per verse.
const mockDbTranslations = new Map<string, string>();
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {
    getTranslation: async (verseKey: string) =>
      mockDbTranslations.get(verseKey) ?? null,
  },
}));
// @ai-end

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
    retainRewayah: () => () => undefined,
    ensureRewayahLoaded: jest.fn(async () => undefined),
  };
  return {digitalKhattDataService: service};
});

// @ai-start
// Decision 3 (verse units): a non-Hafs rewayah's verses come from its verse
// units. These Warsh units are synthetic and numbered like Hafs (every Hafs
// verse of surahs 1-3 is one Warsh verse of placeholder words), so the
// expectations keep their verse keys.
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => {
  const {buildRewayahVerseUnits} = jest.requireActual(
    '@/services/mushaf/RewayahVerseUnits',
  );
  const arabic = (n: number) =>
    String(n).replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d)));
  const counts: Record<number, number> = {1: 7, 2: 286, 3: 200};
  const slots: object[] = [];
  let id = 0;
  for (const surah of [1, 2, 3]) {
    for (let ayah = 1; ayah <= counts[surah]; ayah++) {
      const texts = [
        `WARSH-${ayah}a`,
        `WARSH-${ayah}b`,
        `\u06DD${arabic(ayah)}`,
      ];
      texts.forEach((text, i) => {
        id += 1;
        slots.push({id, surah, ayah, word: i + 1, text});
      });
    }
  }
  const warsh = buildRewayahVerseUnits('warsh', slots, 'warsh@test');
  return {
    rewayahVerseUnitsService: jest
      .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
      .verseUnitsServiceStub({
        peek: (rewayah: string) => (rewayah === 'warsh' ? warsh : null),
      }),
  };
});
// @ai-end

import {ShareContent} from '../ShareContent';
import {SheetFooter} from '../sheetGestures';
import {shareUrl} from '@/utils/shareUtils';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import branding from '@/config/branding'; // @ai

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = branding.shareBaseUrl; // @ai: the host shareUrl() reads (RFC-007)

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
  mockDbTranslations.clear(); // @ai
  (shareUrl as jest.Mock).mockClear();
  shareSpy = jest.spyOn(Share, 'share').mockImplementation(async () => ({
    action: 'sharedAction',
    activityType: undefined,
  }));
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    mushafRenderer: 'dk_v2',
    selectedTranslationId: 'saheeh', // @ai
  });
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

describe('Share as Text', () => {
  // The share-as-text code from before Release 1, kept as the reference
  // output for Hafs.
  function previousMessage(verseKeys: string[], surahName: string): string {
    const arabicText = verseKeys
      .map(vk => digitalKhattDataService.getVerseText(vk, 'hafs'))
      .filter(Boolean)
      .join('\n');
    const translation = verseKeys
      .map(vk => mockTranslations.get(vk) ?? '')
      .filter(Boolean)
      .join('\n');
    const [firstSurah, firstAyah] = verseKeys[0].split(':');
    const [lastSurah, lastAyah] = verseKeys[verseKeys.length - 1].split(':');
    const ref =
      firstSurah === lastSurah
        ? firstAyah === lastAyah
          ? `${firstSurah}:${firstAyah}`
          : `${firstSurah}:${firstAyah}-${lastAyah}`
        : `${firstSurah}:${firstAyah} - ${lastSurah}:${lastAyah}`;
    return `${arabicText}\n\n${translation}\n\n-- Quran ${surahName} ${ref}`;
  }

  const sharedMessage = (): string => {
    expect(shareSpy).toHaveBeenCalledTimes(1);
    return shareSpy.mock.calls[0][0].message;
  };

  it('keeps the empty translation paragraph when there is no translation', async () => {
    open(['1:1'], 'hafs');
    await press('Share as Text');
    expect(sharedMessage()).toBe(
      'HAFS-1a HAFS-1b ۝١\n\n\n\n-- Quran Al-Fatihah 1:1',
    );
  });

  it.each<[string, boolean, string[], string]>([
    ['one verse', false, ['1:1'], 'Al-Fatihah'],
    ['one verse', true, ['1:1'], 'Al-Fatihah'],
    ['a range', false, ['2:255', '2:256', '2:257'], 'Al-Baqarah'],
    ['a range', true, ['2:255', '2:256', '2:257'], 'Al-Baqarah'],
    ['two surahs', false, ['2:286', '3:1', '3:2'], 'Al-Baqarah'],
    ['two surahs', true, ['2:286', '3:1', '3:2'], 'Al-Baqarah'],
  ])(
    'matches the Hafs message from before Release 1: %s, translation %s',
    async (_label, withTranslation, verseKeys, surahName) => {
      if (withTranslation) {
        for (const vk of verseKeys) mockTranslations.set(vk, `T-${vk}`);
      }
      open(verseKeys, 'hafs');
      await press('Share as Text');
      expect(sharedMessage()).toBe(previousMessage(verseKeys, surahName));
    },
  );

  // @ai-start
  // The stored translations mark footnotes inline. Shared as they are, the
  // message read `…the Ever-Living,<sup foot_note="226497">1</sup> the…`.
  it('shares the translation without its footnote markers', async () => {
    mockTranslations.set(
      '2:255',
      'the Ever-Living,<sup foot_note="226497">1</sup> the Self-Sustaining.<sup foot_note=76482>2</sup>',
    );
    open(['2:255'], 'hafs');
    await press('Share as Text');
    expect(sharedMessage()).toBe(
      'HAFS-255a HAFS-255b ۝٢٥٥\n\nthe Ever-Living, the Self-Sustaining.\n\n-- Quran Al-Baqarah 2:255',
    );
  });
  // @ai-end

  // @ai-start
  // A downloaded translation is looked up in a copy held in memory, which is
  // not there right after launch. The message then went out with no
  // translation at all.
  it('reads a downloaded translation from its database when it is not in memory', async () => {
    useMushafSettingsStore.setState({selectedTranslationId: 'ur.jalandhry'});
    mockDbTranslations.set('2:255', 'urdu kursi');
    open(['2:255'], 'hafs');
    await press('Share as Text');
    expect(sharedMessage()).toBe(
      'HAFS-255a HAFS-255b ۝٢٥٥\n\nurdu kursi\n\n-- Quran Al-Baqarah 2:255',
    );
  });
  // @ai-end

  it('uses the same layout for a rewayah, labelled with it', async () => {
    open(['2:255'], 'warsh');
    await press('Share as Text');
    expect(sharedMessage()).toBe(
      'WARSH-255a WARSH-255b ۝٢٥٥\n\n\n\n-- Quran Al-Baqarah 2:255 · Warsh',
    );
  });
});

describe('in the sheet', () => {
  // The sheet's drag starts after 5pt and cancels the press: the buttons
  // sit in a sheet footer, so a tap on one that wobbles is still a tap. The
  // switches are native views, which a footer would keep the touch from.
  it('keeps the sheet drag off the share buttons, not off the switches', () => {
    open(['2:255'], 'hafs');
    if (!renderer) throw new Error('nothing rendered');
    const footers = renderer.root.findAllByType(SheetFooter);
    expect(footers).toHaveLength(1);
    for (const label of ['Share as Image', 'Share as Text', 'Share Link']) {
      expect(
        footers[0].findAll(
          n =>
            typeof n.props.onPress === 'function' &&
            n.findAll(c => c.props.children === label).length > 0,
        ).length,
      ).toBeGreaterThan(0);
    }
    const isSwitch = (n: TestRenderer.ReactTestInstance) =>
      typeof n.props.onValueChange === 'function';
    expect(renderer.root.findAll(isSwitch).length).toBeGreaterThan(0);
    expect(footers[0].findAll(isSwitch)).toEqual([]);
  });
});
