const FORBIDDEN_PUBLIC_KEY_PATTERNS = [
  /QF_AUTHORIZATION_CODE/i,
  /QF.*TOKEN/i,
  /CLIENT_SECRET/i,
];

export interface BayaanAuthConfig {
  qfSyncEnabled: boolean;
  apiUrl: string;
}

export interface PublicBayaanAuthEnv extends Record<
  string,
  string | undefined
> {
  EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED?: string;
  EXPO_PUBLIC_BAYAAN_API_URL?: string;
  EXPO_PUBLIC_QF_CLIENT_ID?: string;
  EXPO_PUBLIC_QF_CLIENT_SECRET?: string;
  EXPO_PUBLIC_QF_AUTHORIZATION_CODE?: string;
  EXPO_PUBLIC_QF_TOKEN?: string;
  EXPO_PUBLIC_CLIENT_SECRET?: string;
  EXPO_PUBLIC_OAUTH_ISSUER_URL?: string;
  EXPO_PUBLIC_USER_API_URL?: string;
  EXPO_PUBLIC_QF_DISCOVERY_URL?: string;
  EXPO_PUBLIC_QF_PROFILE_URL?: string;
}

function parsePublicUrl(value: string) {
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

function isForbiddenQfHost(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith('quran.foundation')) {
    return false;
  }

  return hostname.includes('oauth') || hostname.startsWith('apis');
}

function isForbiddenPublicConfig(
  key: string,
  value: string,
  qfSyncEnabled: boolean,
) {
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

export function assertNoForbiddenPublicBayaanAuthEnv(
  env: Record<string, string | undefined>,
) {
  // Credentials are never public; only the BFF contract is sync-specific.
  const qfSyncEnabled =
    env.EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED?.trim().toLowerCase() === 'true';

  const forbiddenKeys = Object.entries(env)
    .filter(([key, value]) => {
      if (!key.startsWith('EXPO_PUBLIC_')) {
        return false;
      }

      if (!value?.trim()) {
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

export function readBayaanAuthConfig(
  env: PublicBayaanAuthEnv,
): BayaanAuthConfig {
  assertNoForbiddenPublicBayaanAuthEnv(env);

  return {
    qfSyncEnabled:
      env.EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED?.trim().toLowerCase() === 'true',
    apiUrl: env.EXPO_PUBLIC_BAYAAN_API_URL?.trim() ?? '',
  };
}

export const bayaanAuthConfig = readBayaanAuthConfig({
  EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED:
    process.env.EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED,
  EXPO_PUBLIC_BAYAAN_API_URL: process.env.EXPO_PUBLIC_BAYAAN_API_URL,
  EXPO_PUBLIC_QF_CLIENT_ID: process.env.EXPO_PUBLIC_QF_CLIENT_ID,
  EXPO_PUBLIC_QF_CLIENT_SECRET: process.env.EXPO_PUBLIC_QF_CLIENT_SECRET,
  EXPO_PUBLIC_QF_AUTHORIZATION_CODE:
    process.env.EXPO_PUBLIC_QF_AUTHORIZATION_CODE,
  EXPO_PUBLIC_QF_TOKEN: process.env.EXPO_PUBLIC_QF_TOKEN,
  EXPO_PUBLIC_CLIENT_SECRET: process.env.EXPO_PUBLIC_CLIENT_SECRET,
  EXPO_PUBLIC_OAUTH_ISSUER_URL: process.env.EXPO_PUBLIC_OAUTH_ISSUER_URL,
  EXPO_PUBLIC_USER_API_URL: process.env.EXPO_PUBLIC_USER_API_URL,
  EXPO_PUBLIC_QF_DISCOVERY_URL: process.env.EXPO_PUBLIC_QF_DISCOVERY_URL,
  EXPO_PUBLIC_QF_PROFILE_URL: process.env.EXPO_PUBLIC_QF_PROFILE_URL,
});
