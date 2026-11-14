// @ai-generated
/**
 * The preload service owns the Mushaf fonts: one loader for the first load and
 * for a retry, with one set of rules. Every reader sees the same fonts: the
 * `useMushafFontMgr` hook, `fontMgr` (main.tsx) and `quranCommonTypeface`
 * (SkiaPage, QCFPage, SurahDivider, ...). A mount never reads a font file.
 *
 * Each font asset is mocked to its family name, so a read knows its family.
 * `mockFonts.failures` holds how many more reads of a family fail
 * (Infinity: every read).
 */

import React, {act} from 'react';
import * as ReactNative from 'react-native';
import TestRenderer from 'react-test-renderer';

type Provider = {families: string[]};
type Service = {
  initialize(): Promise<void>;
  readonly state: string;
  readonly fontMgr: Provider | null;
  readonly quranCommonTypeface: {family: string} | null;
};

const ALL_FAMILIES = [
  'DigitalKhattV1',
  'DigitalKhattV2',
  'DigitalKhattIndoPak',
  'QuranCommon',
  'SurahNameV4',
  'SurahNameQCF',
  'ManropeSemiBold',
  'ManropeRegular',
  'PlexSansArabicSemiBold',
];

const mockFonts = {
  reads: [] as string[],
  failures: new Map<string, number>(),
};

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: {
      fromURI: async (uri: string) => {
        const family = uri.replace('font://', '');
        mockFonts.reads.push(family);
        const left = mockFonts.failures.get(family) ?? 0;
        if (left > 0) {
          mockFonts.failures.set(family, left - 1);
          throw new Error(`Couldn't read ${family}`);
        }
        return {family};
      },
    },
    Typeface: {
      MakeFreeTypeFaceFromData: (data: {family: string}) => ({
        family: data.family,
      }),
    },
    TypefaceFontProvider: {
      Make: () => {
        const families: string[] = [];
        return {
          families,
          registerFont: (_typeface: unknown, family: string) => {
            families.push(family);
          },
        };
      },
    },
  },
}));

jest.mock(
  '@/data/mushaf/legacy/DigitalKhattQuranicV1.otf',
  () => 'DigitalKhattV1',
);
jest.mock(
  '@/data/mushaf/digitalkhatt/DigitalKhattFont.otf',
  () => 'DigitalKhattV2',
);
jest.mock(
  '@/data/mushaf/indopak/DigitalKhattIndoPak.otf',
  () => 'DigitalKhattIndoPak',
);
jest.mock('@/data/mushaf/quran-common.ttf', () => 'QuranCommon');
jest.mock('@/data/mushaf/surah-name-v4.ttf', () => 'SurahNameV4');
jest.mock('@/data/mushaf/surah-name-qcf.ttf', () => 'SurahNameQCF');
jest.mock('@/assets/fonts/Manrope-SemiBold.ttf', () => 'ManropeSemiBold');
jest.mock('@/assets/fonts/Manrope-Regular.ttf', () => 'ManropeRegular');
jest.mock(
  '@/assets/fonts/IBMPlexSansArabic-SemiBold.ttf',
  () => 'PlexSansArabicSemiBold',
);

// The Mushaf data: `failures` data loads fail, and `gate` holds a load open.
const mockData = {
  initialized: false,
  rewayah: 'hafs',
  failures: 0,
  gate: null as Promise<void> | null,
  async initialize() {
    if (mockData.gate) await mockData.gate;
    if (mockData.failures > 0) {
      mockData.failures -= 1;
      throw new Error('No storage left for the Mushaf data');
    }
    mockData.initialized = true;
  },
  onRewayahChange: () => () => undefined,
};

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: mockData,
}));
jest.mock('@/services/mushaf/QuranTextService', () => ({
  quranTextService: {clearCaches: () => undefined},
}));
jest.mock('@/services/mushaf/RewayahDiffService', () => ({
  rewayahDiffService: {loadForRewayah: () => undefined},
}));
jest.mock('@/services/rewayah/RewayahIdentity', () => ({
  migratePersistedId: (id: string) => id,
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {
    getState: () => ({rewayah: 'hafs', setRewayah: () => undefined}),
    persist: {
      hasHydrated: () => true,
      onFinishHydration: () => () => undefined,
    },
  },
}));

// A new service and hook for each test. React and React Native stay the
// instances that this file uses.
function load(): {service: Service; useMushafFontMgr: () => Provider | null} {
  let loaded!: {service: Service; useMushafFontMgr: () => Provider | null};
  jest.isolateModules(() => {
    jest.doMock('react', () => React);
    jest.doMock('react-native', () => ReactNative);
    loaded = {
      service: require('../MushafPreloadService').mushafPreloadService,
      useMushafFontMgr: require('@/hooks/useMushafFontMgr').useMushafFontMgr,
    };
  });
  return loaded;
}

function mount(useHook: () => Provider | null) {
  const probe = {current: null as Provider | null};
  function Probe(): null {
    probe.current = useHook();
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
  return {
    probe,
    unmount: () =>
      act(() => {
        renderer.unmount();
      }),
  };
}

// Lets the font reads that a mount or a load started finish.
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
}

async function run(promise: Promise<void>): Promise<void> {
  await act(async () => {
    await promise;
  });
}

// The fonts that a reader of the service sees, and the hook's value.
function readers(service: Service, probe: {current: Provider | null}) {
  return {
    hook: probe.current,
    fontMgr: service.fontMgr,
    quranCommon: service.quranCommonTypeface !== null,
  };
}

beforeEach(() => {
  mockFonts.reads = [];
  mockFonts.failures.clear();
  mockData.initialized = false;
  mockData.failures = 0;
  mockData.gate = null;
  jest
    .spyOn(ReactNative.Image, 'resolveAssetSource')
    .mockImplementation(asset => ({
      uri: `font://${String(asset)}`,
      width: 0,
      height: 0,
      scale: 1,
    }));
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('a normal launch reads each font once, and a mount reads none', async () => {
  const {service, useMushafFontMgr} = load();
  await run(service.initialize());

  const {probe} = mount(useMushafFontMgr);
  mount(useMushafFontMgr);
  await settle();

  expect(service.state).toBe('ready');
  expect(mockFonts.reads).toEqual(ALL_FAMILIES);
  expect(probe.current).toBe(service.fontMgr);
  expect(probe.current?.families).toEqual(ALL_FAMILIES);
});

// Review point 3: the two surah name fonts are optional.
it('a surah name font that fails does not hold back the other fonts', async () => {
  const {service, useMushafFontMgr} = load();
  mockFonts.failures.set('SurahNameV4', Infinity);
  mockFonts.failures.set('SurahNameQCF', Infinity);

  await run(service.initialize());
  const {probe} = mount(useMushafFontMgr);

  expect(service.state).toBe('ready');
  expect(probe.current).not.toBeNull();
  expect(probe.current).toBe(service.fontMgr);
  expect(service.quranCommonTypeface).not.toBeNull();
  expect(probe.current?.families).toEqual(
    ALL_FAMILIES.filter(f => f !== 'SurahNameV4' && f !== 'SurahNameQCF'),
  );
});

it('a required font that fails once is read again, and the load succeeds', async () => {
  const {service} = load();
  mockFonts.failures.set('QuranCommon', 1);

  await run(service.initialize());

  expect(service.state).toBe('ready');
  expect(service.quranCommonTypeface).toEqual({family: 'QuranCommon'});
  expect(service.fontMgr?.families).toEqual(ALL_FAMILIES);
});

// Review point 4: no read on each mount while the failure persists.
it('after a failed load, a mount reads no font; only the explicit retry does', async () => {
  const {service, useMushafFontMgr} = load();
  mockFonts.failures.set('QuranCommon', Infinity);

  await run(service.initialize());
  expect(service.state).toBe('failed');
  // One load reads a failing font twice at most.
  expect(mockFonts.reads.filter(f => f === 'QuranCommon')).toHaveLength(2);
  const readsAfterLoad = mockFonts.reads.length;
  const warningsAfterLoad = (console.warn as jest.Mock).mock.calls.length;

  for (let page = 0; page < 3; page += 1) {
    mount(useMushafFontMgr).unmount();
    await settle();
  }
  const {probe} = mount(useMushafFontMgr);
  await settle();

  expect(mockFonts.reads).toHaveLength(readsAfterLoad);
  expect(console.warn).toHaveBeenCalledTimes(warningsAfterLoad);
  expect(probe.current).toBeNull();

  mockFonts.failures.clear();
  await run(service.initialize());

  expect(service.state).toBe('ready');
  expect(probe.current).not.toBeNull();
  expect(probe.current).toBe(service.fontMgr);
});

// Review points 1 and 2: one recovery, in the service, for every reader.
it('every reader sees the same fonts, before and after the retry', async () => {
  const {service, useMushafFontMgr} = load();
  // The reads fail during the first load only.
  mockFonts.failures.set('QuranCommon', 2);

  await run(service.initialize());
  expect(service.state).toBe('failed');
  const {probe} = mount(useMushafFontMgr);
  await settle();

  expect(readers(service, probe)).toEqual({
    hook: null,
    fontMgr: null,
    quranCommon: false,
  });

  await run(service.initialize());

  expect(service.state).toBe('ready');
  expect(probe.current).not.toBeNull();
  expect(readers(service, probe)).toEqual({
    hook: service.fontMgr,
    fontMgr: probe.current,
    quranCommon: true,
  });
});

// Review point 2: the fonts need no Mushaf data.
it('a failed data load still gives every reader the fonts', async () => {
  const {service, useMushafFontMgr} = load();
  mockData.failures = 1;

  await run(service.initialize());
  const {probe} = mount(useMushafFontMgr);

  expect(service.state).toBe('failed');
  expect(probe.current).not.toBeNull();
  expect(readers(service, probe)).toEqual({
    hook: service.fontMgr,
    fontMgr: probe.current,
    quranCommon: true,
  });
});

// Review point 5: no blank pages while the preload retries.
it('a retry of the preload keeps the fonts, and does not read them again', async () => {
  const {service, useMushafFontMgr} = load();
  mockData.failures = 1;
  await run(service.initialize());
  const {probe} = mount(useMushafFontMgr);
  await settle();
  const fonts = probe.current;
  expect(fonts).not.toBeNull();
  const readsBeforeRetry = mockFonts.reads.length;

  let openData!: () => void;
  mockData.gate = new Promise<void>(resolve => {
    openData = resolve;
  });
  let retry!: Promise<void>;
  act(() => {
    retry = service.initialize();
  });
  await settle();

  // A page turn mounts a new page while the retry runs.
  const turned = mount(useMushafFontMgr);
  expect(service.state).toBe('loading');
  expect(turned.probe.current).toBe(fonts);
  expect(probe.current).toBe(fonts);
  expect(service.quranCommonTypeface).not.toBeNull();

  openData();
  await run(retry);

  expect(service.state).toBe('ready');
  expect(probe.current).toBe(fonts);
  expect(mockFonts.reads).toHaveLength(readsBeforeRetry);
});
