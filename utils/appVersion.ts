/**
 * App version information
 *
 * This file provides TypeScript interfaces for version information
 * generated from Git metadata at build time.
 *
 * The actual values are provided by Expo Constants at runtime.
 */
import Constants from 'expo-constants';

/**
 * Interface for version information
 */
export interface AppVersionInfo {
  major: number;
  minor: number;
  patch: number;
  buildNumber: string;
  versionCode: number;
  semanticVersion: string;
  fullVersion: string;
  gitHash?: string;
  gitBranch?: string;
  buildTime?: string;
}

// Access version info from Constants (populated at build time)
export const APP_VERSION: AppVersionInfo = {
  major: parseInt(Constants.expoConfig?.version?.split('.')[0] || '1', 10),
  minor: parseInt(Constants.expoConfig?.version?.split('.')[1] || '0', 10),
  patch: parseInt(Constants.expoConfig?.version?.split('.')[2] || '0', 10),
  buildNumber: Constants.expoConfig?.ios?.buildNumber || '1',
  versionCode: Constants.expoConfig?.android?.versionCode || 1,
  semanticVersion: Constants.expoConfig?.version || '1.0.0',
  fullVersion: Constants.expoConfig?.extra?.version?.fullVersion || '1.0.0 (1)',
  gitHash: Constants.expoConfig?.extra?.version?.gitHash,
  gitBranch: Constants.expoConfig?.extra?.version?.gitBranch,
  buildTime: Constants.expoConfig?.extra?.version?.buildTime,
};

/**
 * Formatted version string (e.g., "1.0.2")
 */
export const getVersionString = (): string => APP_VERSION.semanticVersion;

/**
 * Full version with build info (e.g., "1.0.2 (5)")
 */
export const getFullVersionString = (): string => APP_VERSION.fullVersion;

/**
 * Get build type label for display
 */
export const getBuildTypeLabel = (): string => {
  const isDevelopment = Constants.expoConfig?.extra?.isDevelopmentMode;
  if (isDevelopment) return 'Development Build';
  if (
    APP_VERSION.gitBranch &&
    APP_VERSION.gitBranch !== 'main' &&
    APP_VERSION.gitBranch !== 'master'
  ) {
    return `Preview (${APP_VERSION.gitBranch})`;
  }
  return '';
};
