const FORBIDDEN_PUBLIC_KEY_PATTERNS = [
  /QF_CLIENT/i,
  /QF.*TOKEN/i,
  /CLIENT_SECRET/i,
];

const FORBIDDEN_PUBLIC_VALUE_PATTERNS = [
  /^https:\/\/prelive-oauth2\.quran\.foundation\/?$/i,
  /^https:\/\/apis-prelive\.quran\.foundation\/auth\/?$/i,
];

export interface BayaanAuthConfig {
  qfSyncEnabled: boolean;
  apiUrl: string;
}

function isForbiddenPublicConfig(key: string, value: string) {
  return (
    FORBIDDEN_PUBLIC_KEY_PATTERNS.some(pattern => pattern.test(key)) ||
    FORBIDDEN_PUBLIC_VALUE_PATTERNS.some(pattern => pattern.test(value))
  );
}

export function readBayaanAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): BayaanAuthConfig {
  const forbiddenEntries = Object.entries(env).filter(([key, value]) => {
    if (!key.startsWith('EXPO_PUBLIC_')) {
      return false;
    }

    return isForbiddenPublicConfig(key, value ?? '');
  });

  if (forbiddenEntries.length > 0) {
    const forbiddenKeys = forbiddenEntries.map(([key]) => key).join(', ');
    throw new Error(
      `Forbidden EXPO_PUBLIC_ auth config detected: ${forbiddenKeys}`,
    );
  }

  return {
    qfSyncEnabled:
      env.EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED?.trim().toLowerCase() === 'true',
    apiUrl: env.EXPO_PUBLIC_BAYAAN_API_URL?.trim() ?? '',
  };
}

export const bayaanAuthConfig = readBayaanAuthConfig();
