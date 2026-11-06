// @ai-generated
const mockSetSheetMode = jest.fn();

jest.mock('../store/playerStore', () => ({
  usePlayerStore: {getState: () => ({setSheetMode: mockSetSheetMode})},
}));

import {
  closePlayerSheet,
  expandPlayerSheet,
  measureMiniPlayerAnchor,
  registerMiniPlayerAnchor,
  registerPlayerSheetController,
  unregisterMiniPlayerAnchor,
  unregisterPlayerSheetController,
  type PlayerOrigin,
} from '../sheetRef';

const origin: PlayerOrigin = {x: 8, y: 700, width: 360, height: 56, radius: 28};

beforeEach(() => mockSetSheetMode.mockClear());

it('sets sheetMode and drives the registered controller', () => {
  const controller = {
    expand: jest.fn(),
    close: jest.fn(),
    createOpenGesture: jest.fn(),
  };
  registerPlayerSheetController(controller);

  expandPlayerSheet(origin);
  expect(mockSetSheetMode).toHaveBeenLastCalledWith('full');
  expect(controller.expand).toHaveBeenCalledWith(origin);

  closePlayerSheet();
  expect(mockSetSheetMode).toHaveBeenLastCalledWith('hidden');
  expect(controller.close).toHaveBeenCalled();

  unregisterPlayerSheetController(controller);
});

it('keeps a newer controller when a stale one unregisters', () => {
  const stale = {
    expand: jest.fn(),
    close: jest.fn(),
    createOpenGesture: jest.fn(),
  };
  const current = {
    expand: jest.fn(),
    close: jest.fn(),
    createOpenGesture: jest.fn(),
  };
  registerPlayerSheetController(stale);
  registerPlayerSheetController(current);
  unregisterPlayerSheetController(stale);

  expandPlayerSheet();
  expect(current.expand).toHaveBeenCalled();
  expect(stale.expand).not.toHaveBeenCalled();

  unregisterPlayerSheetController(current);
});

it('measures the registered mini player, or reports none', () => {
  const done = jest.fn();
  measureMiniPlayerAnchor(done);
  expect(done).toHaveBeenLastCalledWith(undefined);

  const measure = (cb: (o?: PlayerOrigin) => void) => cb(origin);
  registerMiniPlayerAnchor(measure);
  measureMiniPlayerAnchor(done);
  expect(done).toHaveBeenLastCalledWith(origin);

  unregisterMiniPlayerAnchor(measure);
  measureMiniPlayerAnchor(done);
  expect(done).toHaveBeenLastCalledWith(undefined);
});

it('skips a mounted mini player that is hidden', () => {
  const done = jest.fn();
  const visible = (cb: (o?: PlayerOrigin) => void) => cb(origin);
  const hidden = (cb: (o?: PlayerOrigin) => void) => cb(undefined);
  registerMiniPlayerAnchor(visible);
  registerMiniPlayerAnchor(hidden);

  measureMiniPlayerAnchor(done);
  expect(done).toHaveBeenCalledTimes(1);
  expect(done).toHaveBeenLastCalledWith(origin);

  unregisterMiniPlayerAnchor(hidden);
  unregisterMiniPlayerAnchor(visible);
});

it('moves past a mini player that never answers', () => {
  jest.useFakeTimers();
  const done = jest.fn();
  const visible = (cb: (o?: PlayerOrigin) => void) => cb(origin);
  const detached = () => undefined;
  registerMiniPlayerAnchor(visible);
  registerMiniPlayerAnchor(detached);

  measureMiniPlayerAnchor(done);
  expect(done).not.toHaveBeenCalled();
  jest.advanceTimersByTime(100);
  expect(done).toHaveBeenCalledTimes(1);
  expect(done).toHaveBeenLastCalledWith(origin);

  unregisterMiniPlayerAnchor(detached);
  unregisterMiniPlayerAnchor(visible);
  jest.useRealTimers();
});
