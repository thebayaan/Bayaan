import {resolveViewableChange} from '../playAllScrollGuard';

describe('resolveViewableChange', () => {
  it('treats a viewable change as a user swipe when no Play All scroll is in flight', () => {
    expect(resolveViewableChange(null, 5)).toEqual({
      isUserSwipe: true,
      target: null,
    });
  });

  it('ignores rows passed on the way during a multi-row Play All jump, however late', () => {
    // Play All jumps 76 -> 79; rows 77 and 78 scroll past first.
    expect(resolveViewableChange(79, 77)).toEqual({
      isUserSwipe: false,
      target: 79,
    });
    expect(resolveViewableChange(79, 78)).toEqual({
      isUserSwipe: false,
      target: 79,
    });
  });

  it('ends the guard once the scroll settles on the target row', () => {
    expect(resolveViewableChange(79, 79)).toEqual({
      isUserSwipe: false,
      target: null,
    });
  });
});
