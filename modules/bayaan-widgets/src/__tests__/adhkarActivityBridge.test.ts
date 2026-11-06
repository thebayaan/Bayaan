import type {NativeBayaanWidgetsModule} from '../NativeBayaanWidgets';
import states from '../__fixtures__/adhkarActivity.states.json';
import {
  endAdhkarSessionActivities,
  startAdhkarSessionActivity,
  updateAdhkarSessionActivity,
} from '../index';
import {
  isAdhkarSessionActivityState,
  type AdhkarSessionActivityState,
} from '../adhkarActivity';

let mockNative: Partial<NativeBayaanWidgetsModule> | null = null;

jest.mock('../NativeBayaanWidgets', () => ({
  get NativeBayaanWidgets(): Partial<NativeBayaanWidgetsModule> | null {
    return mockNative;
  },
}));

function state(): AdhkarSessionActivityState {
  const value: unknown = states[0];
  if (!isAdhkarSessionActivityState(value)) throw new Error('bad fixture');
  return value;
}

describe('adhkar Live Activity wrappers', () => {
  beforeEach(() => {
    mockNative = null;
  });

  it('degrade without the native module', async () => {
    await expect(startAdhkarSessionActivity(state(), 1)).resolves.toBe(
      'unavailable',
    );
    await expect(updateAdhkarSessionActivity(state(), 1)).resolves.toBe(false);
    await expect(endAdhkarSessionActivities()).resolves.toBeUndefined();
  });

  it('degrade when the functions are absent (Android)', async () => {
    mockNative = {writeSnapshot: jest.fn()};
    await expect(startAdhkarSessionActivity(state(), 1)).resolves.toBe(
      'unavailable',
    );
    await expect(updateAdhkarSessionActivity(state(), 1)).resolves.toBe(false);
    await expect(endAdhkarSessionActivities()).resolves.toBeUndefined();
  });

  it('pass JSON and the stale time, and parse the result', async () => {
    const start = jest.fn(async () => 'started');
    const update = jest.fn(async () => true);
    const end = jest.fn(async () => undefined);
    mockNative = {
      startAdhkarSessionActivity: start,
      updateAdhkarSessionActivity: update,
      endAdhkarSessionActivities: end,
    };
    await expect(startAdhkarSessionActivity(state(), 42)).resolves.toBe(
      'started',
    );
    expect(start).toHaveBeenCalledWith(JSON.stringify(state()), 42);
    await expect(updateAdhkarSessionActivity(state(), 43)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(JSON.stringify(state()), 43);
    await endAdhkarSessionActivities();
    expect(end).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenLastCalledWith(null);
  });

  it('pass the dismiss time of a delayed end', async () => {
    const end = jest.fn(async (_at: number | null) => undefined);
    mockNative = {endAdhkarSessionActivities: end};
    await endAdhkarSessionActivities(1_900_000);
    expect(end).toHaveBeenCalledWith(1_900_000);
  });

  it('maps an unknown native result to error', async () => {
    mockNative = {startAdhkarSessionActivity: jest.fn(async () => 'weird')};
    await expect(startAdhkarSessionActivity(state(), 1)).resolves.toBe('error');
  });
});
