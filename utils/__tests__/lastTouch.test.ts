// @ai-generated
import type {GestureResponderEvent} from 'react-native';
import {getRecentTouch, recordTouch} from '@/utils/lastTouch';

const touchAt = (pageX: number, pageY: number) =>
  ({nativeEvent: {pageX, pageY}}) as GestureResponderEvent;

it('remembers the last touch in window points while it is recent', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  recordTouch(touchAt(120, 640));
  expect(getRecentTouch(1200)).toEqual({x: 120, y: 640});
  expect(getRecentTouch(1000 + 1500)).toEqual({x: 120, y: 640});
  expect(getRecentTouch(1000 + 1501)).toBeNull();
  now.mockRestore();
});

it('replaces the anchor with each new touch', () => {
  recordTouch(touchAt(10, 20));
  recordTouch(touchAt(30, 40));
  expect(getRecentTouch()).toEqual({x: 30, y: 40});
});
