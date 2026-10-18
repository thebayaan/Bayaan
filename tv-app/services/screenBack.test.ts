import {
  consumeScreenBack,
  pushScreenBack,
  screenBackCount,
  subscribeScreenBack,
} from './screenBack';
import {useNavStore} from '../store/navStore';

beforeEach(() => {
  useNavStore.getState().reset();
});

describe('screenBack', () => {
  it('asks the newest handler first and stops at the first true', () => {
    const calls: string[] = [];
    const removeA = pushScreenBack(() => {
      calls.push('a');
      return true;
    });
    const removeB = pushScreenBack(() => {
      calls.push('b');
      return false;
    });
    expect(consumeScreenBack()).toBe(true);
    expect(calls).toEqual(['b', 'a']);
    removeA();
    removeB();
    expect(consumeScreenBack()).toBe(false);
  });

  it('only asks the handlers of the showing layer', () => {
    const calls: string[] = [];
    // Search's picker, registered on the root place.
    const removeRoot = pushScreenBack(() => {
      calls.push('root');
      return true;
    });
    useNavStore.getState().push({screen: 'nowPlaying'});
    expect(screenBackCount()).toBe(0);
    expect(consumeScreenBack()).toBe(false);
    expect(calls).toEqual([]);

    const removePlayer = pushScreenBack(() => {
      calls.push('player');
      return true;
    });
    expect(screenBackCount()).toBe(1);
    expect(consumeScreenBack()).toBe(true);
    expect(calls).toEqual(['player']);
    removePlayer();

    // Back on the root place again: its handler is live once more.
    useNavStore.getState().pop();
    expect(screenBackCount()).toBe(1);
    expect(consumeScreenBack()).toBe(true);
    expect(calls).toEqual(['player', 'root']);
    removeRoot();
    expect(screenBackCount()).toBe(0);
  });

  it('tells subscribers when handlers come and go', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeScreenBack(listener);
    const remove = pushScreenBack(() => true);
    remove();
    remove();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    pushScreenBack(() => true)();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('asks only overlay handlers while an overlay is open', () => {
    const screen = jest.fn(() => true);
    const removeScreen = pushScreenBack(screen);
    expect(consumeScreenBack({overlayOpen: true})).toBe(false);
    expect(screen).not.toHaveBeenCalled();
    const menu = jest.fn(() => true);
    const removeMenu = pushScreenBack(menu, {overlay: true});
    expect(consumeScreenBack({overlayOpen: true})).toBe(true);
    expect(menu).toHaveBeenCalledTimes(1);
    removeMenu();
    expect(consumeScreenBack()).toBe(true);
    expect(screen).toHaveBeenCalledTimes(1);
    removeScreen();
  });
});
