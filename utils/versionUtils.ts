import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as semver from 'semver';
import {ChangelogEntry} from '@/types/changelog';

const LAST_SEEN_VERSION_KEY = '@bayaan_last_seen_version';

/**
 * Normalize version string to valid semver format
 * Handles cases like "1.3" -> "1.3.0"
 */
function normalizeVersion(version: string): string {
  const cleaned = semver.clean(version);
  if (cleaned) return cleaned;

  // Handle versions like "1.3" by adding .0
  const parts = version.split('.');
  while (parts.length < 3) {
    parts.push('0');
  }
  return parts.join('.');
}

/**
 * Get the current app version from Expo config
 */
export function getCurrentVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

/**
 * Get the last version that the user saw
 */
export async function getLastSeenVersion(): Promise<string | null> {
  try {
    const lastVersion = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
    return lastVersion;
  } catch (error) {
    console.error('[VersionUtils] Failed to get last seen version:', error);
    return null;
  }
}

/**
 * Check if this is a minor or major version bump (not a patch)
 * Examples:
 * - 1.2.0 -> 1.2.1 = patch (returns false)
 * - 1.2.0 -> 1.3.0 = minor (returns true)
 * - 1.2.0 -> 2.0.0 = major (returns true)
 */
export function isMinorOrMajorUpdate(
  lastVersion: string,
  currentVersion: string,
): boolean {
  const lastNorm = normalizeVersion(lastVersion);
  const currentNorm = normalizeVersion(currentVersion);

  const lastParsed = semver.parse(lastNorm);
  const currentParsed = semver.parse(currentNorm);

  if (!lastParsed || !currentParsed) {
    // Fallback to simple comparison if parsing fails
    return lastVersion !== currentVersion;
  }

  // Check if major or minor version increased
  return (
    currentParsed.major > lastParsed.major ||
    currentParsed.minor > lastParsed.minor
  );
}

/**
 * Check if the app version has changed since the last launch
 * Only returns true for minor/major updates, not patches
 */
export async function hasVersionChanged(): Promise<boolean> {
  try {
    const currentVersion = getCurrentVersion();
    const lastSeenVersion = await getLastSeenVersion();

    console.log('[VersionUtils] Current version:', currentVersion);
    console.log('[VersionUtils] Last seen version:', lastSeenVersion);

    // Show if no version seen (first install or pre-changelog update)
    if (!lastSeenVersion) {
      return true;
    }

    const currentNorm = normalizeVersion(currentVersion);
    const lastNorm = normalizeVersion(lastSeenVersion);

    // Check if current is actually newer (not a downgrade)
    if (!semver.gt(currentNorm, lastNorm)) {
      console.log('[VersionUtils] Not an upgrade, skipping modal');
      return false;
    }

    // Only show for minor/major updates
    const shouldShow = isMinorOrMajorUpdate(lastSeenVersion, currentVersion);
    console.log('[VersionUtils] Is minor/major update:', shouldShow);

    // If it's just a patch, mark as seen silently
    if (!shouldShow) {
      await markVersionAsSeen();
    }

    return shouldShow;
  } catch (error) {
    console.error('[VersionUtils] Failed to check version change:', error);
    return false;
  }
}

/**
 * Get all changelog entries between lastSeenVersion and currentVersion
 * Returns entries where: lastSeenVersion < entry.version <= currentVersion
 * Only includes entries that represent minor/major updates from the last seen version
 */
export function getMissedChangelogs(
  changelogData: ChangelogEntry[],
  lastSeenVersion: string | null,
  currentVersion: string,
): ChangelogEntry[] {
  const currentNorm = normalizeVersion(currentVersion);

  // If no last seen version, return all entries up to current
  if (!lastSeenVersion) {
    return changelogData.filter(entry => {
      const entryNorm = normalizeVersion(entry.version);
      return semver.lte(entryNorm, currentNorm);
    });
  }

  const lastNorm = normalizeVersion(lastSeenVersion);

  // Filter entries: lastSeen < entry <= current
  const missed = changelogData.filter(entry => {
    const entryNorm = normalizeVersion(entry.version);
    return semver.gt(entryNorm, lastNorm) && semver.lte(entryNorm, currentNorm);
  });

  // Sort by version descending (newest first)
  return missed.sort((a, b) => {
    const aNorm = normalizeVersion(a.version);
    const bNorm = normalizeVersion(b.version);
    return semver.rcompare(aNorm, bNorm);
  });
}

/**
 * Mark the current version as seen by the user
 */
export async function markVersionAsSeen(): Promise<void> {
  try {
    const currentVersion = getCurrentVersion();
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
    console.log('[VersionUtils] Marked version as seen:', currentVersion);
  } catch (error) {
    console.error('[VersionUtils] Failed to mark version as seen:', error);
  }
}

/**
 * Filter onboarding pages to only those introduced after lastSeenVersion.
 * If no lastSeenVersion (fresh install), returns all pages.
 */
export function filterPagesByVersion<T extends {minVersion: string}>(
  pages: T[],
  lastSeenVersion: string | null,
): T[] {
  if (!lastSeenVersion) {
    return pages;
  }

  const lastNorm = normalizeVersion(lastSeenVersion);

  return pages.filter(page => {
    const pageNorm = normalizeVersion(page.minVersion);
    return semver.gt(pageNorm, lastNorm);
  });
}

/**
 * Reset the version tracking (useful for testing)
 */
export async function resetVersionTracking(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_SEEN_VERSION_KEY);
    console.log('[VersionUtils] Version tracking reset');
  } catch (error) {
    console.error('[VersionUtils] Failed to reset version tracking:', error);
  }
}
