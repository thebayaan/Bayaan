// @ai-start
import {
  cardPropsEqual,
  pageAt,
  PageTracker,
  planPreload,
  samePlayback,
} from '../feedPlayback';

const H = 800;

describe('pageAt', () => {
  it('rounds to the nearest page and clamps to the list', () => {
    expect(pageAt(0, H, 5)).toBe(0);
    expect(pageAt(399, H, 5)).toBe(0);
    expect(pageAt(401, H, 5)).toBe(1);
    expect(pageAt(-50, H, 5)).toBe(0);
    expect(pageAt(H * 10, H, 5)).toBe(4);
    expect(pageAt(100, 0, 5)).toBe(0);
  });
});

describe('PageTracker', () => {
  it('commits the snap target on release when the platform gives one', () => {
    const pager = new PageTracker(H, 5);
    pager.beginDrag();
    expect(pager.scroll(500)).toBeNull();
    expect(pager.endDrag(200, H)).toBe(1);
    // The snap passes the old page on its way; that must not switch back.
    expect(pager.scroll(300)).toBeNull();
    expect(pager.endMomentum(H)).toBe(1);
  });

  it('never switches while the finger is down', () => {
    const pager = new PageTracker(H, 5);
    pager.beginDrag();
    expect(pager.scroll(500)).toBeNull();
    expect(pager.scroll(300)).toBeNull();
    expect(pager.scroll(600)).toBeNull();
  });

  it('switches when the snap crosses the midpoint without a target', () => {
    const pager = new PageTracker(H, 5);
    pager.beginDrag();
    expect(pager.endDrag(200)).toBeNull();
    expect(pager.scroll(350)).toBe(0);
    expect(pager.scroll(450)).toBe(1);
    expect(pager.endMomentum(H)).toBe(1);
  });

  it('commits a release that lands exactly on a page', () => {
    const pager = new PageTracker(H, 5);
    pager.beginDrag();
    expect(pager.endDrag(H * 2)).toBe(2);
  });

  it('holds an expected programmatic scroll until it lands', () => {
    const pager = new PageTracker(H, 5);
    pager.expect(1);
    expect(pager.scroll(100)).toBeNull();
    expect(pager.endMomentum(H)).toBe(1);
    expect(pager.scroll(H)).toBe(1);
  });

  it('drops a pending target when a new drag starts', () => {
    const pager = new PageTracker(H, 5);
    pager.expect(3);
    pager.beginDrag();
    expect(pager.endDrag(H * 1.2)).toBeNull();
    expect(pager.scroll(H * 1.1)).toBe(1);
  });

  it('follows layout changes', () => {
    const pager = new PageTracker(H, 2);
    expect(pager.endMomentum(H * 3)).toBe(1);
    pager.setLayout(H, 6);
    expect(pager.endMomentum(H * 3)).toBe(3);
  });
});

describe('planPreload', () => {
  it('fills idle slots with the wanted keys, next first', () => {
    expect(planPreload(['a', null, null], 0, ['b', 'z'])).toEqual([
      {slot: 1, key: 'b'},
      {slot: 2, key: 'z'},
    ]);
  });

  it('keeps slots that already hold a wanted key', () => {
    // Swiped from a (slot 0) to b (slot 1): a stays as the previous card.
    expect(planPreload(['a', 'b', 'z'], 1, ['c', 'a'])).toEqual([
      {slot: 2, key: 'c'},
    ]);
    expect(planPreload(['a', 'b', 'c'], 1, ['c', 'a'])).toEqual([]);
  });

  it('never touches the active slot', () => {
    expect(planPreload(['a', 'b'], 0, ['a', 'c', 'd'])).toEqual([
      {slot: 1, key: 'c'},
    ]);
  });

  it('ignores duplicates', () => {
    expect(planPreload(['a', null, null], 0, ['b', 'b'])).toEqual([
      {slot: 1, key: 'b'},
    ]);
  });
});

describe('samePlayback and cardPropsEqual', () => {
  const state = {key: 'k', positionMs: 10, playing: true, buffering: false};

  it('compares playback by value', () => {
    expect(samePlayback(state, {...state})).toBe(true);
    expect(samePlayback(state, {...state, positionMs: 11})).toBe(false);
    expect(samePlayback(null, null)).toBe(true);
    expect(samePlayback(null, state)).toBe(false);
  });

  it('is shallow for every other prop', () => {
    const onLike = () => undefined;
    const props = {playback: state, isLiked: false, onLike};
    expect(cardPropsEqual(props, {...props, playback: {...state}})).toBe(true);
    expect(cardPropsEqual(props, {...props, isLiked: true})).toBe(false);
    expect(cardPropsEqual(props, {...props, onLike: () => undefined})).toBe(
      false,
    );
    expect(cardPropsEqual({playback: null, a: 1}, {playback: null, a: 1})).toBe(
      true,
    );
  });
});
// @ai-end
