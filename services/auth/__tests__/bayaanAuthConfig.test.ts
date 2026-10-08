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

function loadAppConfig() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../app.config.js');
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
    expect(bayaanAuthConfig.apiUrl).toBe('https://api-prelive.thebayaan.com');
    expect(() => loadAppConfig()).not.toThrow();
  });

  it.each([
    ['EXPO_PUBLIC_QF_CLIENT_ID', 'dummy-client-id'],
    ['EXPO_PUBLIC_QF_CLIENT_SECRET', 'dummy-client-secret'],
    ['EXPO_PUBLIC_QF_AUTHORIZATION_CODE', 'dummy-auth-code'],
    ['EXPO_PUBLIC_QF_TOKEN', 'dummy-qf-token'],
    ['EXPO_PUBLIC_CLIENT_SECRET', 'dummy-client-secret'],
    [
      'EXPO_PUBLIC_OAUTH_ISSUER_URL',
      ' https://prelive-oauth2.quran.foundation/.well-known/openid-configuration?foo=bar ',
    ],
    [
      'EXPO_PUBLIC_USER_API_URL',
      'https://apis-prelive.quran.foundation/auth/me?page=1',
    ],
    [
      'EXPO_PUBLIC_QF_DISCOVERY_URL',
      'https://staging-oauth2.quran.foundation/authorize',
    ],
    [
      'EXPO_PUBLIC_QF_PROFILE_URL',
      'https://apis.quran.foundation/auth/profile',
    ],
  ])('rejects forbidden public QF config %s', (key, value) => {
    setPublicEnv({
      EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true',
      [key]: value,
    });

    expect(() => loadBayaanAuthConfig()).toThrow(/EXPO_PUBLIC_/);
    expect(() => loadBayaanAuthConfig()).toThrow(key);
    expect(() => loadAppConfig()).toThrow(key);
  });

  it.each([undefined, '', 'false', ' FALSE ', '0', '1'])(
    'allows a fork QF config when Bayaan sync is disabled (%s)',
    flag => {
      setPublicEnv({
        EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag,
        EXPO_PUBLIC_QF_CLIENT_ID: 'fork-public-client-id',
        EXPO_PUBLIC_QF_CLIENT_SECRET: 'dummy-fork-secret',
        EXPO_PUBLIC_QF_TOKEN: 'dummy-fork-token',
        EXPO_PUBLIC_USER_API_URL: 'https://apis.quran.foundation',
      });

      const {bayaanAuthConfig} = loadBayaanAuthConfig();
      expect(bayaanAuthConfig).toEqual({
        qfSyncEnabled: false,
        apiUrl: 'https://api-prelive.thebayaan.com',
      });
      expect(() => loadAppConfig()).not.toThrow();
    },
  );

  it.each(['true', ' TRUE ', 'True'])(
    'enforces both guards for every enabled flag spelling (%s)',
    flag => {
      setPublicEnv({
        EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag,
        EXPO_PUBLIC_QF_CLIENT_ID: 'fork-public-client-id',
      });
      expect(() => loadBayaanAuthConfig()).toThrow('EXPO_PUBLIC_QF_CLIENT_ID');
      expect(() => loadAppConfig()).toThrow('EXPO_PUBLIC_QF_CLIENT_ID');
    },
  );
});
