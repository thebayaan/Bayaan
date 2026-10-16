import type {NativeBayaanWidgetsModule} from '../NativeBayaanWidgets';
import states from '../__fixtures__/liveActivity.states.json';
import {
  currentNowPlayingActivity,
  endNowPlayingActivities,
  isLiveActivitySupported,
  startNowPlayingActivity,
  updateNowPlayingActivity,
} from '../index';
import {
  isNowPlayingActivityState,
  type NowPlayingActivityState,
} from '../liveActivity';

let mockNative: Partial<NativeBayaanWidgetsModule> | null = null;

jest.mock('../NativeBayaanWidgets', () => ({
  get NativeBayaanWidgets(): Partial<NativeBayaanWidgetsModule> | null {
    return mockNative;
  },
}));

function state(): NowPlayingActivityState {
  const value: unknown = states[0];
  if (!isNowPlayingActivityState(value)) throw new Error('bad fixture');
  return value;
}

describe('Live Activity wrappers', () => {
  beforeEach(() => {
    mockNative = null;
  });

  it('degrade without the native module', async () => {
    expect(isLiveActivitySupported()).toBe(false);
    await expect(startNowPlayingActivity(state(), 1)).resolves.toBe(
      'unavailable',
    );
    await expect(updateNowPlayingActivity(state(), 1)).resolves.toBe(false);
    await expect(endNowPlayingActivities()).resolves.toBeUndefined();
    expect(currentNowPlayingActivity()).toBe(null);
  });

  it('reads the surviving activity state, or null', () => {
    mockNative = {currentNowPlayingActivity: () => JSON.stringify(state())};
    expect(currentNowPlayingActivity()).toEqual(state());
    // Swift omits nil optionals from the JSON.
    const omitted: Record<string, unknown> = {...state()};
    delete omitted.artworkFile;
    delete omitted.ayah;
    mockNative = {
      currentNowPlayingActivity: () => JSON.stringify(omitted),
    };
    expect(currentNowPlayingActivity()).toEqual({
      ...omitted,
      artworkFile: null,
      ayah: null,
    });
    mockNative = {currentNowPlayingActivity: () => ''};
    expect(currentNowPlayingActivity()).toBe(null);
    mockNative = {currentNowPlayingActivity: () => '{not json'};
    expect(currentNowPlayingActivity()).toBe(null);
    mockNative = {currentNowPlayingActivity: () => '{"surahId":1}'};
    expect(currentNowPlayingActivity()).toBe(null);
  });

  it('degrade when the functions are absent (Android)', async () => {
    mockNative = {writeSnapshot: jest.fn()};
    expect(isLiveActivitySupported()).toBe(false);
    await expect(startNowPlayingActivity(state(), 1)).resolves.toBe(
      'unavailable',
    );
    await expect(updateNowPlayingActivity(state(), 1)).resolves.toBe(false);
  });

  it('pass JSON and the stale time, and parse the result', async () => {
    const start = jest.fn(async () => 'started');
    const update = jest.fn(async () => true);
    const end = jest.fn(async () => undefined);
    mockNative = {
      isLiveActivitySupported: () => true,
      startNowPlayingActivity: start,
      updateNowPlayingActivity: update,
      endNowPlayingActivities: end,
    };
    expect(isLiveActivitySupported()).toBe(true);
    await expect(startNowPlayingActivity(state(), 42)).resolves.toBe('started');
    expect(start).toHaveBeenCalledWith(JSON.stringify(state()), 42);
    await expect(updateNowPlayingActivity(state(), 43)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(JSON.stringify(state()), 43);
    await endNowPlayingActivities();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('maps an unknown native result to error', async () => {
    mockNative = {startNowPlayingActivity: jest.fn(async () => 'weird')};
    await expect(startNowPlayingActivity(state(), 1)).resolves.toBe('error');
  });
});
