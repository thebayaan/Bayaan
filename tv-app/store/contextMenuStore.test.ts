import {
  claimFocusReturn,
  noteLongPressOrigin,
  ORIGIN_TTL_MS,
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
});
