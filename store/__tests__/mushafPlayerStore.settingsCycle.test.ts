// @ai-generated
/**
 * The mushaf player re-labels the verse being recited when the mushaf's
 * rewayah changes, through a subscription to the settings store made when
 * the player store module is evaluated. If an import cycle ever leaves the
 * settings store undefined at that moment, the subscription is skipped:
 * development builds must say so instead of failing silently. A stand-in
 * store without subscribe (tests) is skipped quietly.
 */

jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));

jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));

const CYCLE_WARNING = 'mushafSettingsStore is not defined yet';

/** Evaluate the player store against `settingsModule`; the warnings logged. */
function warningsWith(settingsModule: object): string[] {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    jest.isolateModules(() => {
      jest.doMock('@/store/mushafSettingsStore', () => settingsModule);
      require('../mushafPlayerStore');
    });
    return warn.mock.calls.map(args => String(args[0]));
  } finally {
    warn.mockRestore();
  }
}

it('warns when the settings store is not defined yet (an import cycle)', () => {
  const warnings = warningsWith({useMushafSettingsStore: undefined});
  expect(warnings.some(w => w.includes(CYCLE_WARNING))).toBe(true);
});

it('does not warn about a stand-in settings store without subscribe', () => {
  const warnings = warningsWith({
    useMushafSettingsStore: {getState: () => ({rewayah: 'hafs'})},
  });
  expect(warnings.some(w => w.includes(CYCLE_WARNING))).toBe(false);
});
