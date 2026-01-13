/**
 * Development utilities for testing and debugging
 * These functions should only be used during development
 */

import {
  resetVersionTracking,
  getCurrentVersion,
  getLastSeenVersion,
} from './versionUtils';

/**
 * Reset the What's New modal for testing
 * This clears the last seen version, so the modal will appear on next launch
 */
export async function testWhatsNewModal(): Promise<void> {
  console.log("[DevUtils] Resetting What's New modal for testing...");
  await resetVersionTracking();
  console.log("[DevUtils] What's New modal will appear on next app launch");
}

/**
 * Log current version tracking state
 */
export async function logVersionState(): Promise<void> {
  const currentVersion = getCurrentVersion();
  const lastSeenVersion = await getLastSeenVersion();

  console.log('=== Version State ===');
  console.log('Current Version:', currentVersion);
  console.log('Last Seen Version:', lastSeenVersion || 'none');
  console.log(
    'Modal will show:',
    !lastSeenVersion || currentVersion !== lastSeenVersion,
  );
  console.log('====================');
}

/**
 * Quick test function to verify the What's New feature
 * Usage: Call this from the app, then restart to see the modal
 */
export async function quickTestWhatsNew(): Promise<void> {
  console.log("[DevUtils] Starting What's New quick test...");
  await logVersionState();
  await testWhatsNewModal();
  console.log(
    "[DevUtils] Test complete. Restart the app to see the What's New modal.",
  );
}
