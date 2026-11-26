// @ai-generated
import {
  requestSearchFocus,
  subscribeSearchFocus,
  takeSearchFocusRequest,
} from '../searchFocus';

beforeEach(() => {
  jest.useFakeTimers();
  // Nothing left waiting from the test before.
  takeSearchFocusRequest();
});

afterEach(() => {
  jest.useRealTimers();
});

it('hands a request over once', () => {
  expect(takeSearchFocusRequest()).toBe(false);
  requestSearchFocus();
  expect(takeSearchFocusRequest()).toBe(true);
  expect(takeSearchFocusRequest()).toBe(false);
});

it('tells the search screen when it is already on show', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeSearchFocus(listener);
  requestSearchFocus();
  expect(listener).toHaveBeenCalledTimes(1);

  unsubscribe();
  requestSearchFocus();
  expect(listener).toHaveBeenCalledTimes(1);
});

it('keeps a request while the Search tab opens', () => {
  requestSearchFocus();
  jest.advanceTimersByTime(2000);
  expect(takeSearchFocusRequest()).toBe(true);
});

// ⌘F from another tab while Search shows a screen opened from it: nothing
// takes the request. Going back to the search screen minutes later must not
// put the cursor in the field.
it('drops a request that nothing took', () => {
  requestSearchFocus();
  jest.advanceTimersByTime(60_000);
  expect(takeSearchFocusRequest()).toBe(false);

  // The next one is a request of its own.
  requestSearchFocus();
  expect(takeSearchFocusRequest()).toBe(true);
});
