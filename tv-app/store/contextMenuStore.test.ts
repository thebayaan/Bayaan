import {
  claimFocusReturn,
  noteLongPressOrigin,
  ORIGIN_TTL_MS,
  setScreenFocusRestore,
} from '../services/focusReturn';
import {useContextMenuStore} from './contextMenuStore';
import {useNavStore} from './navStore';

function opener() {
  const requestTVFocus = jest.fn();
  return {ref: {current: {requestTVFocus}}, requestTVFocus};
}

describe('contextMenuStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useContextMenuStore.getState().close({restoreFocus: false});
    useNavStore.getState().reset();
  });
  afterEach(() => jest.useRealTimers());

  it('opens a reciter menu, keeping the reciterId selector', () => {
    useContextMenuStore.getState().openReciter('r1');
    expect(useContextMenuStore.getState().target).toEqual({
      kind: 'reciter',
      reciterId: 'r1',
    });
    expect(useContextMenuStore.getState().reciterId).toBe('r1');
  });

  it('opens a surah menu and updates it in place', () => {
    useContextMenuStore.getState().openSurah({
      surahNumber: 2,
      reciterId: 'r1',
      origin: 'playlist',
      playlistId: 'p',
      playlistIndex: 3,
    });
    expect(useContextMenuStore.getState().reciterId).toBeNull();
    useContextMenuStore.getState().updateSurah({playlistIndex: 2});
    expect(useContextMenuStore.getState().target).toMatchObject({
      kind: 'surah',
      surahNumber: 2,
      playlistIndex: 2,
    });
  });

  it('opens a playlist menu and leaves the surah target alone', () => {
    const {ref} = opener();
    useContextMenuStore.getState().openPlaylist('p1', ref);
    expect(useContextMenuStore.getState().target).toEqual({
      kind: 'playlist',
      playlistId: 'p1',
    });
    expect(useContextMenuStore.getState().reciterId).toBeNull();
    expect(useContextMenuStore.getState().opener).toBe(ref);
    useContextMenuStore.getState().updateSurah({playlistIndex: 1});
    expect(useContextMenuStore.getState().target).toEqual({
      kind: 'playlist',
      playlistId: 'p1',
    });
  });

  it('gives focus back to the view that opened it', () => {
    const {ref, requestTVFocus} = opener();
    useContextMenuStore.getState().openReciter('r1', ref);
    useContextMenuStore.getState().close();
    expect(useContextMenuStore.getState().target).toBeNull();
    jest.runAllTimers();
    expect(requestTVFocus).toHaveBeenCalledTimes(1);
  });

  it('takes the opener from the long-press that opened it', () => {
    const {ref, requestTVFocus} = opener();
    noteLongPressOrigin(ref);
    useContextMenuStore.getState().openSurah({surahNumber: 1});
    useContextMenuStore.getState().close();
    jest.runAllTimers();
    expect(requestTVFocus).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale long-press', () => {
    const {ref, requestTVFocus} = opener();
    noteLongPressOrigin(ref);
    jest.advanceTimersByTime(ORIGIN_TTL_MS + 1);
    jest.setSystemTime(Date.now() + ORIGIN_TTL_MS + 1);
    useContextMenuStore.getState().openSurah({surahNumber: 1});
    useContextMenuStore.getState().close();
    jest.runAllTimers();
    expect(requestTVFocus).not.toHaveBeenCalled();
  });

  it('does not restore focus when an action leaves the screen', () => {
    const {ref, requestTVFocus} = opener();
    useContextMenuStore.getState().openReciter('r1', ref);
    useContextMenuStore.getState().close({restoreFocus: false});
    jest.runAllTimers();
    expect(requestTVFocus).not.toHaveBeenCalled();
  });

  it('leaves focus to a screen that claims it on close', () => {
    const {ref, requestTVFocus} = opener();
    useContextMenuStore.getState().openReciter('r1', ref);
    const unsubscribe = useContextMenuStore.subscribe(next => {
      if (next.target === null) claimFocusReturn();
    });
    useContextMenuStore.getState().close();
    unsubscribe();
    jest.runAllTimers();
    expect(requestTVFocus).not.toHaveBeenCalled();
    // The claim is used up: the next close restores again.
    useContextMenuStore.getState().openReciter('r1', ref);
    useContextMenuStore.getState().close();
    jest.runAllTimers();
    expect(requestTVFocus).toHaveBeenCalledTimes(1);
  });

  it('closes on navigation without restoring focus', () => {
    const {ref, requestTVFocus} = opener();
    useContextMenuStore.getState().openReciter('r1', ref);
    useNavStore.getState().push({screen: 'reciterDetail', reciterId: 'r1'});
    expect(useContextMenuStore.getState().target).toBeNull();
    useContextMenuStore.getState().openReciter('r2', ref);
    useNavStore.getState().switchTab('surahs');
    expect(useContextMenuStore.getState().target).toBeNull();
    jest.runAllTimers();
    expect(requestTVFocus).not.toHaveBeenCalled();
  });

  describe('with a screen layer showing', () => {
    const screenRestore = jest.fn();
    let unregister: () => void = () => {};
    beforeEach(() => {
      screenRestore.mockClear();
      unregister = setScreenFocusRestore(screenRestore);
    });
    afterEach(() => unregister());

    it('focuses the opener, not the layer, when the opener is still there', () => {
      const {ref, requestTVFocus} = opener();
      useContextMenuStore.getState().openReciter('r1', ref);
      useContextMenuStore.getState().close();
      jest.runAllTimers();
      expect(requestTVFocus).toHaveBeenCalledTimes(1);
      expect(screenRestore).not.toHaveBeenCalled();
    });

    it("falls back to the layer's memory when the opener is gone or unknown", () => {
      const gone = {current: null};
      useContextMenuStore.getState().openReciter('r1', gone);
      useContextMenuStore.getState().close();
      jest.runAllTimers();
      expect(screenRestore).toHaveBeenCalledTimes(1);
      useContextMenuStore.getState().openSurah({surahNumber: 1});
      useContextMenuStore.getState().close();
      jest.runAllTimers();
      expect(screenRestore).toHaveBeenCalledTimes(2);
    });

    it('leaves a claimed or navigating close alone', () => {
      useContextMenuStore.getState().openReciter('r1', {current: null});
      const unsubscribe = useContextMenuStore.subscribe(next => {
        if (next.target === null) claimFocusReturn();
      });
      useContextMenuStore.getState().close();
      unsubscribe();
      useContextMenuStore.getState().openReciter('r1', {current: null});
      useNavStore.getState().push({screen: 'reciterDetail', reciterId: 'r1'});
      jest.runAllTimers();
      expect(screenRestore).not.toHaveBeenCalled();
    });
  });
});
