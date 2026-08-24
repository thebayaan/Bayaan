const originalEnv = {...process.env};

function setPublicEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED = 'false';
  process.env.EXPO_PUBLIC_BAYAAN_API_URL = 'https://api-prelive.thebayaan.com';

  for (const key of Object.keys(process.env)) {
    if (key.startsWith('EXPO_PUBLIC_') && !(key in overrides)) {
      delete process.env[key];
    }
  }

  process.env.EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED = 'false';
  process.env.EXPO_PUBLIC_BAYAAN_API_URL = 'https://api-prelive.thebayaan.com';

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function loadBayaanAuthConfig() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../config/bayaanAuth');
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
});

describe('bayaan auth public config', () => {
  it('exposes only the Bayaan BFF public auth keys', () => {
    setPublicEnv({
      EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true',
    });

    const {bayaanAuthConfig} = loadBayaanAuthConfig();

    expect(bayaanAuthConfig.qfSyncEnabled).toBe(true);
    expect(bayaanAuthConfig.apiUrl).toBe(
      'https://api-prelive.thebayaan.com',
    );
  });

  it.each([
    ['EXPO_PUBLIC_QF_CLIENT_ID', 'dummy-client-id'],
    ['EXPO_PUBLIC_QF_CLIENT_SECRET', 'dummy-client-secret'],
    ['EXPO_PUBLIC_QF_TOKEN', 'dummy-qf-token'],
    ['EXPO_PUBLIC_CLIENT_SECRET', 'dummy-client-secret'],
    [
      'EXPO_PUBLIC_OAUTH_ISSUER_URL',
      'https://prelive-oauth2.quran.foundation',
    ],
    [
      'EXPO_PUBLIC_USER_API_URL',
      'https://apis-prelive.quran.foundation/auth',
    ],
  ])('rejects forbidden public QF config %s', (key, value) => {
    setPublicEnv({
      [key]: value,
    });

    expect(() => loadBayaanAuthConfig()).toThrow(/EXPO_PUBLIC_/);
    expect(() => loadBayaanAuthConfig()).toThrow(key);
  });
});
