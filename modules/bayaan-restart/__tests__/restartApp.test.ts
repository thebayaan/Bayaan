// @ai-generated
const mockRestart = jest.fn();
const mockLaunchedFromLauncher = jest.fn();
let mockNative: {
  restart: typeof mockRestart;
  launchedFromLauncher?: typeof mockLaunchedFromLauncher;
} | null = {restart: mockRestart};

jest.mock('expo', () => ({
  requireOptionalNativeModule: () => mockNative,
}));

function loadModule() {
  return require('..') as typeof import('..');
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockNative = {restart: mockRestart};
});

it('asks the native module to restart with the layout direction', () => {
  const restart = loadModule();
  expect(restart.canRestartApp).toBe(true);
  expect(restart.restartApp(true)).toBe(true);
  expect(mockRestart).toHaveBeenCalledWith(true);
});

it('reports that it cannot restart where the native module is missing', () => {
  mockNative = null;
  const restart = loadModule();
  expect(restart.canRestartApp).toBe(false);
  expect(restart.restartApp(false)).toBe(false);
});

it('reports a failed restart instead of throwing', () => {
  mockRestart.mockImplementation(() => {
    throw new Error('The react context has been lost');
  });
  expect(loadModule().restartApp(true)).toBe(false);
});

describe('whether the launcher opened the screen on show', () => {
  // A restart starts the app again as the launcher does, so a launch from a
  // link or a shared file must not restart.
  it.each([true, false])('passes on the native answer (%s)', answer => {
    mockNative = {
      restart: mockRestart,
      launchedFromLauncher: mockLaunchedFromLauncher,
    };
    mockLaunchedFromLauncher.mockReturnValue(answer);
    expect(loadModule().launchedFromLauncher()).toBe(answer);
  });

  it('answers no where it cannot tell', () => {
    // No native module (iOS).
    mockNative = null;
    expect(loadModule().launchedFromLauncher()).toBe(false);

    // A native build older than this JS, e.g. after an update over the air.
    jest.resetModules();
    mockNative = {restart: mockRestart};
    expect(loadModule().launchedFromLauncher()).toBe(false);

    // The native side failed.
    jest.resetModules();
    mockNative = {
      restart: mockRestart,
      launchedFromLauncher: mockLaunchedFromLauncher,
    };
    mockLaunchedFromLauncher.mockImplementation(() => {
      throw new Error('The react context has been lost');
    });
    expect(loadModule().launchedFromLauncher()).toBe(false);
  });
});
