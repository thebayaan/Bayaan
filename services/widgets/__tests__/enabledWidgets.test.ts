// RFC-021: which widget kinds sync reloads, and the Live Activity gate.
type EnabledWidgets = typeof import('../enabledWidgets');
type LiveActivityConfig = typeof import('../live-activity/config');

function withWidgets<T>(
  widgets: string[] | undefined,
  run: (enabled: EnabledWidgets, live: LiveActivityConfig) => T,
  flags: Record<string, boolean> = {},
): T {
  let result: T | undefined;
  let ran = false;
  jest.isolateModules(() => {
    jest.doMock('@/config/nativeWidgets.config', () => ({
      __esModule: true,
      default: {widgets},
    }));
    jest.doMock('@/config/featureFlags', () => {
      const actual = jest.requireActual('@/config/featureFlags');
      return {...actual, featureFlags: {...actual.featureFlags, ...flags}};
    });
    const enabled: EnabledWidgets = require('../enabledWidgets');
    const live: LiveActivityConfig = require('../live-activity/config');
    result = run(enabled, live);
    ran = true;
  });
  if (!ran || result === undefined)
    throw new Error('isolateModules did not run');
  return result;
}

describe('enabledKinds', () => {
  it('keeps every kind for the default config', () => {
    const kinds = withWidgets(undefined, ({enabledKinds}) =>
      enabledKinds(['ContinueListening', 'QuickSurah', 'Tasbeeh']),
    );
    expect(kinds).toEqual(['ContinueListening', 'QuickSurah', 'Tasbeeh']);
  });

  it('drops kinds a fork lists out', () => {
    const kinds = withWidgets(['QuickSurah'], ({enabledKinds}) =>
      enabledKinds(['QuickSurah', 'Tasbeeh', 'BayaanNow']),
    );
    expect(kinds).toEqual(['QuickSurah']);
  });

  it('keeps ContinueListening while the Lock Screen widget or play/pause control ships', () => {
    expect(
      withWidgets(['ListeningAccessory'], ({enabledKinds}) =>
        enabledKinds(['ContinueListening']),
      ),
    ).toEqual(['ContinueListening']);
    expect(
      withWidgets(['PlaybackControl'], ({enabledKinds}) =>
        enabledKinds(['ContinueListening']),
      ),
    ).toEqual(['ContinueListening']);
    expect(
      withWidgets(['QuickSurah'], ({enabledKinds}) =>
        enabledKinds(['ContinueListening', 'QuickSurah']),
      ),
    ).toEqual(['QuickSurah']);
  });
});

describe('liveActivityMode', () => {
  it('is off for Quran playback, even with LiveActivity shipped', () => {
    expect(withWidgets(undefined, (_, live) => live.liveActivityMode())).toBe(
      'off',
    );
  });

  it('is off when a fork lists LiveActivity out', () => {
    expect(
      withWidgets(['ContinueListening'], (_, live) => live.liveActivityMode()),
    ).toBe('off');
  });
});

describe('adhkarLiveActivityEnabled', () => {
  it('is on by default', () => {
    expect(
      withWidgets(undefined, (_, live) => live.adhkarLiveActivityEnabled()),
    ).toBe(true);
  });

  it('is off when a fork lists LiveActivity out', () => {
    expect(
      withWidgets(['ContinueListening'], (_, live) =>
        live.adhkarLiveActivityEnabled(),
      ),
    ).toBe(false);
  });

  it('is off when the adhkar feature is off', () => {
    expect(
      withWidgets(undefined, (_, live) => live.adhkarLiveActivityEnabled(), {
        adhkar: false,
      }),
    ).toBe(false);
  });
});
