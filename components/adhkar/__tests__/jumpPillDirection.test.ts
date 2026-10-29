import {
  jumpPillDirection,
  visibleRowIndices,
} from '@/components/adhkar/AdhkarJumpPill';

jest.mock('react-native-reanimated', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View: MockView},
    cancelAnimation: jest.fn(),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    useSharedValue: (v: number) => ({value: v}),
    withDelay: (_d: number, v: number) => v,
    withRepeat: (v: number) => v,
    withTiming: (v: number) => v,
  };
});

it('is null when the target is visible or missing', () => {
  expect(jumpPillDirection([3, 4, 5], 4)).toBeNull();
  expect(jumpPillDirection([3, 4, 5], null)).toBeNull();
  expect(jumpPillDirection([], 4)).toBeNull();
});
it('points up when the target is above the visible rows', () => {
  expect(jumpPillDirection([10, 11, 12], 2)).toBe('up');
});
it('points down when the target is below', () => {
  expect(jumpPillDirection([0, 1, 2], 9)).toBe('down');
});

it('ignores section header tokens when collecting visible rows', () => {
  const tokens = [
    {index: null, item: undefined as {globalIndex: number} | undefined},
    {index: 0, item: {globalIndex: 4}},
    {index: 1, item: {globalIndex: 5}},
  ];
  const rows = visibleRowIndices(tokens, v => v.item?.globalIndex);
  expect(rows).toEqual([4, 5]);
  expect(jumpPillDirection(rows, 2)).toBe('up');
});

it('counts every card of a paired row as visible', () => {
  const tokens = [
    {index: null, item: undefined as {globalIndex: number}[] | undefined},
    {index: 0, item: [{globalIndex: 4}, {globalIndex: 5}]},
    {index: 1, item: [{globalIndex: 6}]},
  ];
  const rows = visibleRowIndices(tokens, v => v.item?.map(i => i.globalIndex));
  expect(rows).toEqual([4, 5, 6]);
  expect(jumpPillDirection(rows, 5)).toBeNull();
});
