/**
 * The Mushaf font manager: a normal launch loads no fonts in this hook, and a
 * failed preload gets one shared provider for all callers.
 */

import React, {act} from 'react';
import * as ReactNative from 'react-native';
import TestRenderer from 'react-test-renderer';

type Listener = () => void;
type FontMgr = object | null;

const FONT_COUNT = 6;

const mockService = {
  initialized: false,
  loadError: false,
  fontMgr: null as FontMgr,
  listeners: new Set<Listener>(),
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },
  finish(state: {fontMgr: FontMgr; loadError: boolean}) {
    this.initialized = true;
    this.fontMgr = state.fontMgr;
    this.loadError = state.loadError;
    for (const listener of this.listeners) listener();
  },
};

const mockFromURI = jest.fn();
const mockMakeTypeface = jest.fn();
const mockMakeProvider = jest.fn();

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: mockService,
}));

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: {fromURI: (uri: string) => mockFromURI(uri)},
    Typeface: {
      MakeFreeTypeFaceFromData: (data: unknown) => mockMakeTypeface(data),
    },
    TypefaceFontProvider: {Make: () => mockMakeProvider()},
  },
}));

// The module keeps the shared provider, so each test gets a new copy. React
// and React Native stay the instances that this file uses.
function loadHook(): () => FontMgr {
  let hook!: () => FontMgr;
  jest.isolateModules(() => {
    jest.doMock('react', () => React);
    jest.doMock('react-native', () => ReactNative);
    hook = require('../useMushafFontMgr').useMushafFontMgr;
  });
  return hook;
}

function mount(useHook: () => FontMgr) {
  const probe = {current: null as FontMgr, renders: 0};
  function Probe(): null {
    probe.current = useHook();
    probe.renders += 1;
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

// Lets the sequential font reads finish.
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('useMushafFontMgr', () => {
  beforeEach(() => {
    mockService.initialized = false;
    mockService.loadError = false;
    mockService.fontMgr = null;
    mockService.listeners.clear();
    mockFromURI.mockReset().mockResolvedValue({});
    mockMakeTypeface.mockReset().mockReturnValue({});
    mockMakeProvider.mockReset().mockImplementation(() => ({
      registerFont: jest.fn(),
    }));
    jest
      .spyOn(ReactNative.Image, 'resolveAssetSource')
      .mockReturnValue({uri: 'asset://font', width: 0, height: 0, scale: 1});
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads no fonts while the preload runs and after it succeeds', () => {
    const useMushafFontMgr = loadHook();
    const preloaded = {name: 'preloaded'};

    const first = mount(useMushafFontMgr);
    expect(first.probe.current).toBeNull();

    act(() => mockService.finish({fontMgr: preloaded, loadError: false}));
    const second = mount(useMushafFontMgr);

    expect(first.probe.current).toBe(preloaded);
    expect(second.probe.current).toBe(preloaded);
    expect(mockFromURI).not.toHaveBeenCalled();
    expect(mockMakeProvider).not.toHaveBeenCalled();
  });

  it('does not render a caller again after a mount or a repeat notification', async () => {
    const useMushafFontMgr = loadHook();
    mockService.initialized = true;
    mockService.fontMgr = {name: 'preloaded'};

    const {probe} = mount(useMushafFontMgr);
    await settle();
    act(() =>
      mockService.finish({fontMgr: mockService.fontMgr, loadError: false}),
    );

    expect(probe.renders).toBe(1);
  });

  it('gives all callers one provider, loaded once, after the preload fails', async () => {
    const useMushafFontMgr = loadHook();
    const first = mount(useMushafFontMgr);
    const second = mount(useMushafFontMgr);

    act(() => mockService.finish({fontMgr: null, loadError: true}));
    await settle();

    expect(first.probe.current).not.toBeNull();
    expect(second.probe.current).toBe(first.probe.current);
    const late = mount(useMushafFontMgr);
    await settle();
    expect(late.probe.current).toBe(first.probe.current);
    expect(mockMakeProvider).toHaveBeenCalledTimes(1);
    expect(mockFromURI).toHaveBeenCalledTimes(FONT_COUNT);
  });

  it('starts the load for a component that mounts after the failure', async () => {
    const useMushafFontMgr = loadHook();
    mockService.initialized = true;
    mockService.loadError = true;

    const {probe} = mount(useMushafFontMgr);
    await settle();

    expect(probe.current).not.toBeNull();
    expect(mockFromURI).toHaveBeenCalledTimes(FONT_COUNT);
  });

  it('registers each font under its family name, one read at a time', async () => {
    const useMushafFontMgr = loadHook();
    mockService.initialized = true;
    mockService.loadError = true;
    let reading = 0;
    let mostAtOnce = 0;
    mockFromURI.mockImplementation(async () => {
      reading += 1;
      mostAtOnce = Math.max(mostAtOnce, reading);
      await Promise.resolve();
      reading -= 1;
      return {};
    });

    mount(useMushafFontMgr);
    await settle();

    expect(mostAtOnce).toBe(1);
    const provider = mockMakeProvider.mock.results[0].value;
    expect(
      provider.registerFont.mock.calls.map(
        ([, family]: [unknown, string]) => family,
      ),
    ).toEqual([
      'DigitalKhattV1',
      'DigitalKhattV2',
      'DigitalKhattIndoPak',
      'QuranCommon',
      'SurahNameV4',
      'SurahNameQCF',
    ]);
  });

  it('stays null after a failed load, and the next mount tries again', async () => {
    const useMushafFontMgr = loadHook();
    mockService.initialized = true;
    mockService.loadError = true;
    mockMakeTypeface.mockReturnValueOnce(null);

    const first = mount(useMushafFontMgr);
    await settle();
    expect(first.probe.current).toBeNull();
    expect(mockFromURI).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);

    const second = mount(useMushafFontMgr);
    await settle();

    expect(second.probe.current).not.toBeNull();
    expect(first.probe.current).toBe(second.probe.current);
    expect(mockMakeProvider).toHaveBeenCalledTimes(2);
  });

  it('prefers the preloaded provider when a retry of the preload succeeds', async () => {
    const useMushafFontMgr = loadHook();
    mockService.initialized = true;
    mockService.loadError = true;
    const {probe} = mount(useMushafFontMgr);
    await settle();
    expect(probe.current).not.toBeNull();

    const preloaded = {name: 'preloaded'};
    act(() => mockService.finish({fontMgr: preloaded, loadError: false}));

    expect(probe.current).toBe(preloaded);
  });

  it('stops listening after an unmount', () => {
    const useMushafFontMgr = loadHook();

    const {unmount} = mount(useMushafFontMgr);
    expect(mockService.listeners.size).toBe(1);

    unmount();
    expect(mockService.listeners.size).toBe(0);
  });
});
