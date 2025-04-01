#!/usr/bin/env node

/**
 * Git-based version generator
 *
 * This script extracts version information from Git metadata:
 * - Semantic version from the latest Git tag
 * - Build numbers from commit counts
 * - Additional metadata like branch and commit hash
 *
 * Usage:
 *   const versionInfo = require('./scripts/generate-version');
 *   console.log(versionInfo.semanticVersion); // e.g., "1.0.3"
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Safely executes a Git command and returns the result
 * Returns fallback value if command fails
 */
function safeExec(command, fallback = '') {
  try {
    return execSync(command, {stdio: ['pipe', 'pipe', 'ignore']})
      .toString()
      .trim();
  } catch (error) {
    return fallback;
  }
}

/**
 * Extract the current semantic version from Git tags
 * Follows pattern like "v1.2.3" or "1.2.3"
 */
function getSemanticVersion() {
  // Try to get the latest tag that looks like a version
  let tag = safeExec(
    'git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*" --match "[0-9]*.[0-9]*.[0-9]*" 2>/dev/null',
  );

  // If no version tags found, check existing version as fallback
  if (!tag) {
    // Try to read from package.json as fallback
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'package.json')),
      );
      tag = packageJson.version || '1.0.0';
    } catch (e) {
      // Default fallback version if all else fails
      tag = '1.0.0';
    }
  }

  // Strip the 'v' prefix if present
  return tag.replace(/^v/, '');
}

/**
 * Get build number from total commit count
 * This ensures build numbers always increase
 */
function getBuildNumber() {
  // Override from env var if provided (useful for CI/CD)
  if (process.env.BUILD_NUMBER) {
    return process.env.BUILD_NUMBER;
  }

  // Try to get total commit count
  const commitCount = safeExec('git rev-list --count HEAD', '1');

  // Ensure it's a positive integer
  const count = parseInt(commitCount, 10);
  return isNaN(count) || count <= 0 ? '1' : String(count);
}

/**
 * Get version code for Android
 * Must be an integer that increases with each release
 */
function getVersionCode() {
  const buildNumber = getBuildNumber();
  return parseInt(buildNumber, 10);
}

/**
 * Get the current Git branch name
 */
function getCurrentBranch() {
  return safeExec('git rev-parse --abbrev-ref HEAD', 'unknown');
}

/**
 * Get the current commit hash (short version)
 */
function getGitHash() {
  return safeExec('git rev-parse --short HEAD', 'unknown');
}

/**
 * Generate a build timestamp
 */
function getBuildTime() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Get full version string for display
 */
function getFullVersion(semanticVersion, buildNumber) {
  return `${semanticVersion} (${buildNumber})`;
}

/**
 * Parse semantic version components
 */
function parseVersionComponents(version) {
  const parts = version.split('.');
  return {
    major: parseInt(parts[0] || 0, 10),
    minor: parseInt(parts[1] || 0, 10),
    patch: parseInt(parts[2] || 0, 10),
  };
}

// Generate the complete version information
function generateVersionInfo() {
  const semanticVersion = getSemanticVersion();
  const buildNumber = getBuildNumber();
  const versionCode = getVersionCode();
  const gitBranch = getCurrentBranch();
  const gitHash = getGitHash();
  const buildTime = getBuildTime();
  const fullVersion = getFullVersion(semanticVersion, buildNumber);
  const versionComponents = parseVersionComponents(semanticVersion);

  return {
    semanticVersion,
    buildNumber,
    versionCode,
    gitBranch,
    gitHash,
    buildTime,
    fullVersion,
    ...versionComponents,
  };
}

// Generate version info
const versionInfo = generateVersionInfo();

// Log version info if script is executed directly
if (require.main === module) {
  console.log('Generated version information:');
  console.log(JSON.stringify(versionInfo, null, 2));
}

module.exports = versionInfo;
