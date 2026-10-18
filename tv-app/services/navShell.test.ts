import {
  backStep,
  showsNowPlayingPill,
  stackLayers,
  type BackState,
} from './navShell';
import type {ScreenEntry} from '../store/navStore';

const reciter: ScreenEntry = {screen: 'reciterDetail', reciterId: 'r1'};
const player: ScreenEntry = {screen: 'nowPlaying'};

function state(over: Partial<BackState> = {}): BackState {
  return {
    stack: [],
    tab: 'home',
    menuOpen: false,
    overlayOpen: false,
    panelOpen: false,
    trayOpen: false,
    pickerOpen: false,
    sidebarFocused: false,
    ...over,
  };
}

describe('stackLayers', () => {
  it('keeps covered screens mounted, only the top active', () => {
    const layers = stackLayers([
      reciter,
      {screen: 'playlist', playlistId: 'p'},
    ]);
    expect(layers.map(l => l.entry.screen)).toEqual([
      'reciterDetail',
      'playlist',
    ]);
    expect(layers.map(l => l.active)).toEqual([false, true]);
  });

  it('drops a covered player, which remounts from its store', () => {
    const layers = stackLayers([player, reciter]);
    expect(layers.map(l => l.entry.screen)).toEqual(['reciterDetail']);
    expect(layers[0].active).toBe(true);
  });

  it('keeps a key per depth, so a layer is not remounted by a push above it', () => {
    const before = stackLayers([reciter]);
    const after = stackLayers([reciter, player]);
    expect(after[0].key).toBe(before[0].key);
    expect(after[1].key).not.toBe(after[0].key);
  });

  it('is empty for a root place', () => {
    expect(stackLayers([])).toEqual([]);
  });
});

describe('showsNowPlayingPill', () => {
  it('shows on stacked screens without the sidebar, not on the player or editor', () => {
    expect(showsNowPlayingPill(reciter)).toBe(true);
    expect(showsNowPlayingPill({screen: 'playlist', playlistId: 'p'})).toBe(
      true,
    );
    expect(showsNowPlayingPill({screen: 'adhkarReader', listId: 'l'})).toBe(
      true,
    );
    expect(showsNowPlayingPill(player)).toBe(false);
    expect(showsNowPlayingPill({screen: 'playlistEdit'})).toBe(false);
  });
});

describe('backStep', () => {
  it('closes what is open on top first', () => {
    expect(backStep(state({menuOpen: true, stack: [player]}))).toBe(
      'closeMenu',
    );
    expect(backStep(state({overlayOpen: true}))).toBe('closeOverlay');
    expect(
      backStep(state({stack: [player], panelOpen: true, trayOpen: true})),
    ).toBe('closePanel');
    expect(backStep(state({stack: [player], trayOpen: true}))).toBe(
      'lowerTray',
    );
  });

  it("ignores the player's tray when the player is not on top", () => {
    expect(backStep(state({stack: [player, reciter], trayOpen: true}))).toBe(
      'pop',
    );
  });

  it('pops a stacked screen', () => {
    expect(backStep(state({stack: [reciter]}))).toBe('pop');
  });

  it("closes Settings' picker only on Settings", () => {
    expect(backStep(state({tab: 'settings', pickerOpen: true}))).toBe(
      'closePicker',
    );
    expect(backStep(state({tab: 'surahs', pickerOpen: true}))).toBe(
      'focusSidebar',
    );
  });

  it('steps a root place out: content, sidebar, Home, then out', () => {
    expect(backStep(state({tab: 'surahs'}))).toBe('focusSidebar');
    expect(backStep(state({tab: 'surahs', sidebarFocused: true}))).toBe(
      'goHome',
    );
    expect(backStep(state({tab: 'home'}))).toBe('focusSidebar');
    expect(backStep(state({tab: 'home', sidebarFocused: true}))).toBe('exit');
  });
});
