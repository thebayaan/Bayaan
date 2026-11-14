// @ai-generated
/**
 * The Mushaf font manager hook reads the preload service's provider and loads
 * no fonts. The service owns the load and the retry: see
 * services/mushaf/__tests__/MushafPreloadService.fonts.test.tsx.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {useMushafFontMgr} from '../useMushafFontMgr';

type Listener = () => void;
type FontMgr = object | null;

const mockService = {
  state: 'idle',
  fontMgr: null as FontMgr,
  listeners: new Set<Listener>(),
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },
  finish(state: string, fontMgr: FontMgr) {
    this.state = state;
    this.fontMgr = fontMgr;
    for (const listener of this.listeners) listener();
  },
};

const mockFromURI = jest.fn();
const mockMakeProvider = jest.fn();

// A getter: the hook module loads before `mockService` is set.
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  get mushafPreloadService() {
    return mockService;
  },
}));

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: {fromURI: () => mockFromURI()},
    TypefaceFontProvider: {Make: () => mockMakeProvider()},
  },
}));

function mount() {
  const probe = {current: null as FontMgr, renders: 0};
  function Probe(): null {
    probe.current = useMushafFontMgr() as FontMgr;
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

describe('useMushafFontMgr', () => {
  beforeEach(() => {
    mockService.state = 'idle';
    mockService.fontMgr = null;
    mockService.listeners.clear();
    mockFromURI.mockReset();
    mockMakeProvider.mockReset();
  });

  it('loads no fonts, and returns the provider when the preload has it', () => {
    const preloaded = {name: 'preloaded'};

    const first = mount();
    expect(first.probe.current).toBeNull();

    act(() => mockService.finish('ready', preloaded));
    const second = mount();

    expect(first.probe.current).toBe(preloaded);
    expect(second.probe.current).toBe(preloaded);
    expect(mockFromURI).not.toHaveBeenCalled();
    expect(mockMakeProvider).not.toHaveBeenCalled();
  });

  it('stays null after a failed preload, and loads nothing', () => {
    mockService.state = 'failed';

    const {probe} = mount();
    mount();

    expect(probe.current).toBeNull();
    expect(mockFromURI).not.toHaveBeenCalled();
    expect(mockMakeProvider).not.toHaveBeenCalled();
  });

  it('returns the provider while the preload retries', () => {
    mockService.state = 'loading';
    mockService.fontMgr = {name: 'loaded before the retry'};

    const {probe} = mount();

    expect(probe.current).toBe(mockService.fontMgr);
  });

  it('does not render a caller again after a mount or a repeat notification', () => {
    mockService.state = 'ready';
    mockService.fontMgr = {name: 'preloaded'};

    const {probe} = mount();
    mount();
    act(() => mockService.finish('ready', mockService.fontMgr));

    expect(probe.renders).toBe(1);
  });

  it('stops listening after an unmount', () => {
    const {unmount} = mount();
    expect(mockService.listeners.size).toBe(1);

    unmount();
    expect(mockService.listeners.size).toBe(0);
  });
});
