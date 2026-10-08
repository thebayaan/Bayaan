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
  return require('../../../config/bayaanAuth');
}

function loadAppConfig() {
  jest.resetModules();
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

  describe.each([undefined, 'false', 'true'])('sync flag %s', flag => {
    it.each([
      ['EXPO_PUBLIC_QF_CLIENT_SECRET', 'dummy-client-secret'],
      ['EXPO_PUBLIC_QF_AUTHORIZATION_CODE', 'dummy-auth-code'],
      ['EXPO_PUBLIC_QF_TOKEN', 'dummy-qf-token'],
      ['EXPO_PUBLIC_CLIENT_SECRET', 'dummy-client-secret'],
    ])('always rejects public credentials %s', (key, value) => {
      setPublicEnv({
        EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag,
        [key]: value,
      });

      expect(() => loadBayaanAuthConfig()).toThrow(key);
      expect(() => loadAppConfig()).toThrow(key);
    });

    it.each([
      ['EXPO_PUBLIC_QF_CLIENT_ID', 'dummy-client-id'],
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
    ])('gates only the BFF contract config %s', (key, value) => {
      setPublicEnv({
        EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag,
        [key]: value,
      });

      if (flag === 'true') {
        expect(() => loadBayaanAuthConfig()).toThrow(key);
        expect(() => loadAppConfig()).toThrow(key);
      } else {
        const {bayaanAuthConfig} = loadBayaanAuthConfig();
        expect(bayaanAuthConfig.qfSyncEnabled).toBe(false);
        expect(() => loadAppConfig()).not.toThrow();
      }
    });

    it.each([
      'EXPO_PUBLIC_OTHER_CLIENT_SECRET',
      'EXPO_PUBLIC_qf_AUTHORIZATION_CODE',
      'EXPO_PUBLIC_qf_ACCESS_TOKEN',
      'EXPO_PUBLIC_QF_REFRESH_TOKEN',
    ])('matches credential patterns in both guards for %s', key => {
      setPublicEnv({EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag});
      const {assertNoForbiddenPublicBayaanAuthEnv: runtimeGuard} =
        loadBayaanAuthConfig();
      const {
        assertNoForbiddenPublicBayaanAuthEnv: buildGuard,
      } = require('../../../config/bayaanAuth.build');
      const env = {
        EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag,
        [key]: 'dummy-credential',
      };

      expect(() => runtimeGuard(env)).toThrow(key);
      expect(() => buildGuard(env)).toThrow(key);
    });

    it('allows empty public credentials and non-public credentials', () => {
      setPublicEnv({
        EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag,
        EXPO_PUBLIC_QF_CLIENT_SECRET: ' ',
        EXPO_PUBLIC_QF_AUTHORIZATION_CODE: '',
        EXPO_PUBLIC_QF_TOKEN: undefined,
        EXPO_PUBLIC_CLIENT_SECRET: '',
        QF_CLIENT_SECRET: 'server-only-secret',
      });

      expect(() => loadBayaanAuthConfig()).not.toThrow();
      expect(() => loadAppConfig()).not.toThrow();
    });
  });

  it.each([undefined, '', 'false', ' FALSE ', '0', '1'])(
    'allows a fork public QF config when Bayaan sync is disabled (%s)',
    flag => {
      setPublicEnv({
        EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag,
        EXPO_PUBLIC_QF_CLIENT_ID: 'fork-public-client-id',
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

  it('does not reject unrelated public QF client keys', () => {
    setPublicEnv({EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true'});
    const {assertNoForbiddenPublicBayaanAuthEnv: runtimeGuard} =
      loadBayaanAuthConfig();
    const {
      assertNoForbiddenPublicBayaanAuthEnv: buildGuard,
    } = require('../../../config/bayaanAuth.build');
    const env = {
      EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true',
      EXPO_PUBLIC_QF_CLIENT_NAME: 'fork-client',
    };

    expect(() => runtimeGuard(env)).not.toThrow();
    expect(() => buildGuard(env)).not.toThrow();
  });

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
