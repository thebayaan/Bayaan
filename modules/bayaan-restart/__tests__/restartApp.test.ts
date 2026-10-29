// @ai-generated
const mockRestart = jest.fn();
let mockNative: {restart: typeof mockRestart} | null = {restart: mockRestart};

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
