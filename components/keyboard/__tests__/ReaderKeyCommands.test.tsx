// @ai-generated
import React, {act} from 'react';
import TestRenderer, {type ReactTestRenderer} from 'react-test-renderer';
import {ReaderKeyCommands} from '../ReaderKeyCommands';
import {AppKeyCommands} from '../AppKeyCommands';
import {
  pressKeyForTests,
  resetKeyCommandsForTests,
} from '@/services/keyboard/keyCommands';
import {togglePlayback, toggleRecitation} from '@/services/keyboard/keyActions';
import {BayaanKeyboard} from '@/modules/bayaan-keyboard';

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {t: (key: string) => key},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/modules/bayaan-keyboard', () => ({
  BayaanKeyboard: {
    isAvailable: true,
    setCommands: jest.fn(),
    addKeyCommandListener: jest.fn(() => () => undefined),
  },
}));

let mockFocused = true;
jest.mock('expo-router', () => ({
  useIsFocused: () => mockFocused,
  useSegments: () => ['mushaf'],
  router: {canGoBack: () => false, back: jest.fn()},
}));

let mockSheetMode = 'hidden';
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (s: unknown) => unknown) =>
    select({
      sheetMode: mockSheetMode,
      queue: {tracks: [{id: 'a'}], currentIndex: 0},
    }),
}));
jest.mock('@/services/keyboard/keyActions', () => ({
  closeFullPlayer: jest.fn(() => false),
  closeTopSheet: jest.fn(() => false),
  skipTrack: jest.fn(),
  togglePlayback: jest.fn(),
  toggleRecitation: jest.fn(),
}));

const turnTo = jest.fn();
const openSearch = jest.fn();
const onEscape = jest.fn();
let mounted: ReactTestRenderer | undefined;

function renderReader(
  props: Partial<React.ComponentProps<typeof ReaderKeyCommands>> = {},
) {
  const element = (p: typeof props) => (
    <>
      <AppKeyCommands />
      <ReaderKeyCommands
        currentPage={10}
        pageStep={1}
        canTurnPage
        turnTo={turnTo}
        openSearch={openSearch}
        onEscape={onEscape}
        {...p}
      />
    </>
  );
  act(() => {
    mounted = TestRenderer.create(element(props));
  });
  return {
    rerender(next: typeof props) {
      act(() => mounted?.update(element(next)));
    },
  };
}

/** The keys the native menu lists, with the menu each sits in. */
function listed(): string[] {
  const calls = (BayaanKeyboard.setCommands as jest.Mock).mock.calls;
  const commands = calls.at(-1)?.[1] ?? [];
  return commands.map((c: {id: string; menu: string}) => `${c.id}:${c.menu}`);
}

beforeEach(() => {
  resetKeyCommandsForTests();
  jest.clearAllMocks();
  mockFocused = true;
  mockSheetMode = 'hidden';
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

describe('ReaderKeyCommands', () => {
  it('turns pages with Space, ⇧Space and the arrows in mushaf direction', () => {
    renderReader();
    pressKeyForTests('space');
    expect(turnTo).toHaveBeenLastCalledWith(11);
    pressKeyForTests('shift-space');
    expect(turnTo).toHaveBeenLastCalledWith(9);
    pressKeyForTests('left');
    expect(turnTo).toHaveBeenLastCalledWith(11);
    pressKeyForTests('right');
    expect(turnTo).toHaveBeenLastCalledWith(9);
    expect(togglePlayback).not.toHaveBeenCalled();
  });

  it('turns a whole spread at a time', () => {
    renderReader({currentPage: 11, pageStep: 2});
    pressKeyForTests('space');
    expect(turnTo).toHaveBeenLastCalledWith(13);
    pressKeyForTests('shift-space');
    expect(turnTo).toHaveBeenLastCalledWith(9);
  });

  it('stops at the first and last pages', () => {
    const r = renderReader({currentPage: 1});
    pressKeyForTests('shift-space');
    expect(turnTo).not.toHaveBeenCalled();
    r.rerender({currentPage: 603, pageStep: 2});
    pressKeyForTests('space');
    expect(turnTo).toHaveBeenLastCalledWith(604);
  });

  it('does not turn pages while search covers them', () => {
    renderReader({canTurnPage: false});
    pressKeyForTests('space');
    pressKeyForTests('left');
    expect(turnTo).not.toHaveBeenCalled();
  });

  it('plays the recitation, searches and closes', () => {
    renderReader();
    pressKeyForTests('option-space');
    expect(toggleRecitation).toHaveBeenCalledWith(10);
    pressKeyForTests('cmd-f');
    expect(openSearch).toHaveBeenCalled();
    pressKeyForTests('escape');
    expect(onEscape).toHaveBeenCalled();
  });

  it('gives the keys back to the player while the full player is open', () => {
    mockSheetMode = 'full';
    renderReader();
    pressKeyForTests('space');
    expect(turnTo).not.toHaveBeenCalled();
    expect(togglePlayback).toHaveBeenCalled();
    expect(listed()).not.toContain('cmd-f:reader');
  });

  it('lists its keys under the reader menu while on screen only', () => {
    const r = renderReader();
    expect(listed()).toEqual(
      expect.arrayContaining(['space:reader', 'cmd-f:reader', 'escape:reader']),
    );
    mockFocused = false;
    r.rerender({});
    expect(listed()).toEqual([
      'space:playback',
      'cmd-left:playback',
      'cmd-right:playback',
      'escape:go',
    ]);
  });
});
