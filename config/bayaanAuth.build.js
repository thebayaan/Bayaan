const FORBIDDEN_PUBLIC_KEY_PATTERNS = [
  /QF_AUTHORIZATION_CODE/i,
  /QF.*TOKEN/i,
  /CLIENT_SECRET/i,
];

function parsePublicUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function isForbiddenQfHost(url) {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith('quran.foundation')) {
    return false;
  }

  return hostname.includes('oauth') || hostname.startsWith('apis');
}

function isForbiddenPublicConfig(key, value, qfSyncEnabled) {
  if (FORBIDDEN_PUBLIC_KEY_PATTERNS.some(pattern => pattern.test(key))) {
    return true;
  }

  if (!qfSyncEnabled) {
    return false;
  }

  if (/QF_CLIENT_ID/i.test(key)) {
    return true;
  }

  const parsedUrl = parsePublicUrl(value);
  return parsedUrl ? isForbiddenQfHost(parsedUrl) : false;
}

function assertNoForbiddenPublicBayaanAuthEnv(env) {
  // Credentials are never public; only the BFF contract is sync-specific.
  const qfSyncEnabled =
    env.EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED?.trim().toLowerCase() === 'true';

  const forbiddenKeys = Object.entries(env)
    .filter(([key, value]) => {
      if (!key.startsWith('EXPO_PUBLIC_')) {
        return false;
      }

      if (!value || !value.trim()) {
        return false;
      }

      return isForbiddenPublicConfig(key, value ?? '', qfSyncEnabled);
    })
    .map(([key]) => key);

  if (forbiddenKeys.length > 0) {
    throw new Error(
      `Forbidden EXPO_PUBLIC_ auth config detected: ${forbiddenKeys.join(', ')}`,
    );
  }
}

module.exports = {
  assertNoForbiddenPublicBayaanAuthEnv,
};
