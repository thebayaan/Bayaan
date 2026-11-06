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

describe('branding qfBffBase', () => {
  const env = {
    EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true',
    EXPO_PUBLIC_BAYAAN_API_URL: 'https://api-prelive.thebayaan.com',
  };

  afterEach(() => {
    jest.dontMock('../../../config/branding');
  });

  function loadWithBranding(qfBffBase: string) {
    jest.resetModules();
    jest.doMock('../../../config/branding', () => ({qfBffBase}));
    return require('../../../config/bayaanAuth');
  }

  it('uses the branding BFF base instead of the env API URL', () => {
    const {readBayaanAuthConfig} = loadBayaanAuthConfig();

    expect(readBayaanAuthConfig(env, ' https://bff.fork.test ')).toEqual({
      qfSyncEnabled: true,
      apiUrl: 'https://bff.fork.test',
    });
  });

  it.each([undefined, '', '  '])(
    'uses the env API URL when the branding BFF base is %p',
    qfBffBase => {
      const {readBayaanAuthConfig} = loadBayaanAuthConfig();

      expect(readBayaanAuthConfig(env, qfBffBase)).toEqual({
        qfSyncEnabled: true,
        apiUrl: 'https://api-prelive.thebayaan.com',
      });
    },
  );

  describe.each(['true', 'false'])('sync flag %s', flag => {
    it.each([
      'https://oauth2.quran.foundation',
      'https://prelive-oauth2.quran.foundation/authorize',
      'https://apis.quran.foundation',
      ' https://apis-prelive.quran.foundation/auth/me ',
    ])('rejects a QF host as the branding BFF base (%s)', qfBffBase => {
      const {readBayaanAuthConfig} = loadBayaanAuthConfig();

      expect(() =>
        readBayaanAuthConfig(
          {...env, EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: flag},
          qfBffBase,
        ),
      ).toThrow('qfBffBase');
    });
  });

  it('names the Quran Foundation host it rejects', () => {
    const {readBayaanAuthConfig} = loadBayaanAuthConfig();

    expect(() =>
      readBayaanAuthConfig(env, 'https://apis-prelive.quran.foundation'),
    ).toThrow('Quran Foundation host apis-prelive.quran.foundation');
  });

  it.each([
    'https://bff.fork.test/',
    ' https://bff.fork.test/ ',
    'http://localhost:3000',
    'https://bff.fork.test:8443/',
  ])('accepts an origin, with or without a trailing slash (%p)', qfBffBase => {
    const {readBayaanAuthConfig} = loadBayaanAuthConfig();

    expect(readBayaanAuthConfig(env, qfBffBase)).toEqual({
      qfSyncEnabled: true,
      apiUrl: qfBffBase.trim(),
    });
  });

  it.each([
    ['https://fork.test/bff', 'a path'],
    ['https://fork.test/bff/', 'a path'],
    ['https://fork.test/v1/qf', 'a path'],
    ['https://fork.test/?env=prod', 'a query'],
    ['https://fork.test/#bff', 'a fragment'],
    ['https://fork.test/bff?env=prod', 'a path, a query'],
  ])(
    'rejects a branding BFF base that is not an origin (%s)',
    (qfBffBase, found) => {
      const {readBayaanAuthConfig} = loadBayaanAuthConfig();

      expect(() => readBayaanAuthConfig(env, qfBffBase)).toThrow(
        `qfBffBase must be an origin only, such as https://fork.test; found ${found}`,
      );
    },
  );

  it('does not repeat credentials when it rejects a base with userinfo', () => {
    const {readBayaanAuthConfig} = loadBayaanAuthConfig();
    let message = '';

    try {
      readBayaanAuthConfig(env, 'https://user:secret@fork.test');
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(
      'origin only, such as https://fork.test; found credentials',
    );
    expect(message).not.toContain('secret');
  });

  it.each([
    'bff.fork.test',
    'localhost:3000',
    '/v1/qf',
    'ftp://bff.fork.test',
    'not a url',
  ])(
    'rejects a branding BFF base that is not an absolute http(s) URL (%s)',
    qfBffBase => {
      const {readBayaanAuthConfig} = loadBayaanAuthConfig();

      expect(() => readBayaanAuthConfig(env, qfBffBase)).toThrow(
        `qfBffBase must be an absolute http(s) URL, got "${qfBffBase}"`,
      );
    },
  );

  it('fails at load when branding gives the BFF base a path', () => {
    setPublicEnv({EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true'});

    expect(() => loadWithBranding('https://fork.test/bff')).toThrow(
      'qfBffBase must be an origin only',
    );
  });

  it('reads the BFF base from branding at runtime', () => {
    setPublicEnv({EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true'});

    const {bayaanAuthConfig} = loadWithBranding('https://bff.fork.test');

    expect(bayaanAuthConfig).toEqual({
      qfSyncEnabled: true,
      apiUrl: 'https://bff.fork.test',
    });
  });

  it('fails at load when branding points the BFF at a QF host', () => {
    setPublicEnv({EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true'});

    expect(() => loadWithBranding('https://apis.quran.foundation')).toThrow(
      'qfBffBase',
    );
  });

  it('keeps the Bayaan default: no branding BFF base, env API URL', () => {
    setPublicEnv({EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true'});

    const {bayaanAuthConfig} = loadBayaanAuthConfig();

    expect(require('../../../config/branding').qfBffBase).toBeUndefined();
    expect(bayaanAuthConfig.apiUrl).toBe('https://api-prelive.thebayaan.com');
  });
});
