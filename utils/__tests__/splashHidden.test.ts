// @ai-generated
const mockHideAsync = jest.fn((): Promise<boolean> => Promise.resolve(true));
jest.mock('expo-splash-screen', () => ({
  hideAsync: () => mockHideAsync(),
}));

function load(): typeof import('../splashHidden') {
  let mod: typeof import('../splashHidden') | null = null;
  jest.isolateModules(() => {
    mod = require('../splashHidden');
  });
  if (!mod) throw new Error('module failed to load');
  return mod;
}

async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false;
  promise.then(() => {
    done = true;
  });
  await new Promise(resolve => setImmediate(resolve));
  return done;
}

describe('splashHidden', () => {
  it('stays open until the first hide', async () => {
    const {whenSplashHidden} = load();
    expect(await settled(whenSplashHidden())).toBe(false);
  });

  it('settles when the hide finishes', async () => {
    const {hideSplash, whenSplashHidden} = load();
    await hideSplash();
    expect(await settled(whenSplashHidden())).toBe(true);
  });

  it('settles also when the hide fails, and hideSplash still rejects', async () => {
    mockHideAsync.mockImplementationOnce(() =>
      Promise.reject(new Error('no splash')),
    );
    const {hideSplash, whenSplashHidden} = load();
    await expect(hideSplash()).rejects.toThrow('no splash');
    expect(await settled(whenSplashHidden())).toBe(true);
  });
});
