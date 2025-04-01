/**
 * Central source of truth for app versioning
 * Update these values when releasing a new version
 */
export const APP_VERSION = {
  // Semantic versioning
  major: 1,
  minor: 0,
  patch: 2,
  
  // Build numbers
  buildNumber: '5', // iOS build number (string)
  versionCode: 5, // Android version code (number)
  
  // Additional info
  buildType: 'release', // 'debug', 'release', 'beta', etc.
  releaseChannel: 'production', // 'development', 'staging', 'production', etc.
};

// Formatted version string (e.g., "1.0.2")
export const getVersionString = () => 
  `${APP_VERSION.major}.${APP_VERSION.minor}.${APP_VERSION.patch}`;

// Full version with build info (e.g., "1.0.2 (5)")
export const getFullVersionString = () => 
  `${getVersionString()} (${APP_VERSION.buildNumber})`;

// Get build type label for display
export const getBuildTypeLabel = () => {
  if (APP_VERSION.buildType === 'debug') return 'Development Build';
  if (APP_VERSION.buildType === 'beta') return 'Beta';
  return '';
}; 