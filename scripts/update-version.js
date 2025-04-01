#!/usr/bin/env node

/**
 * Script to update app version numbers
 * Usage: node scripts/update-version.js <major|minor|patch> [buildNumber]
 * Example: node scripts/update-version.js patch 6
 */

const fs = require('fs');
const path = require('path');

// Path to version files
const versionFilePath = path.join(__dirname, '..', 'utils', 'appVersion.ts');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const appJsonPath = path.join(__dirname, '..', 'app.json');

// Read version file
let versionFileContent = fs.readFileSync(versionFilePath, 'utf8');

// Get current version from file using regex
const majorRegex = /major:\s*(\d+),/;
const minorRegex = /minor:\s*(\d+),/;
const patchRegex = /patch:\s*(\d+),/;
const buildNumberRegex = /buildNumber:\s*['"](\d+)['"],/;
const versionCodeRegex = /versionCode:\s*(\d+),/;

const currentMajor = parseInt(versionFileContent.match(majorRegex)[1]);
const currentMinor = parseInt(versionFileContent.match(minorRegex)[1]);
const currentPatch = parseInt(versionFileContent.match(patchRegex)[1]);
const currentBuildNumber = parseInt(versionFileContent.match(buildNumberRegex)[1]);
const currentVersionCode = parseInt(versionFileContent.match(versionCodeRegex)[1]);

// Get update type from command line argument
const updateType = process.argv[2] || 'patch';

// Get build number from command line or increment current
const newBuildNumber = process.argv[3] 
  ? parseInt(process.argv[3]) 
  : currentBuildNumber + 1;

// Calculate new version
let newMajor = currentMajor;
let newMinor = currentMinor;
let newPatch = currentPatch;

switch (updateType) {
  case 'major':
    newMajor = currentMajor + 1;
    newMinor = 0;
    newPatch = 0;
    break;
  case 'minor':
    newMinor = currentMinor + 1;
    newPatch = 0;
    break;
  case 'patch':
  default:
    newPatch = currentPatch + 1;
    break;
}

// Create new version string
const newVersionString = `${newMajor}.${newMinor}.${newPatch}`;

// Update version in appVersion.ts file content
versionFileContent = versionFileContent
  .replace(majorRegex, `major: ${newMajor},`)
  .replace(minorRegex, `minor: ${newMinor},`)
  .replace(patchRegex, `patch: ${newPatch},`)
  .replace(buildNumberRegex, `buildNumber: '${newBuildNumber}',`)
  .replace(versionCodeRegex, `versionCode: ${newBuildNumber},`);

// Write updated content back to appVersion.ts file
fs.writeFileSync(versionFilePath, versionFileContent);

// Update package.json
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersionString;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated package.json version to ${newVersionString}`);
}

// Update app.json
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  appJson.expo.version = newVersionString;
  
  // Also update iOS buildNumber if it exists
  if (appJson.expo.ios && appJson.expo.ios.buildNumber) {
    appJson.expo.ios.buildNumber = String(newBuildNumber);
    console.log(`✅ Updated iOS buildNumber to ${newBuildNumber}`);
  }
  
  // Also update Android versionCode if it exists
  if (appJson.expo.android) {
    // Add versionCode if it doesn't exist
    if (!appJson.expo.android.versionCode) {
      appJson.expo.android.versionCode = newBuildNumber;
    } else {
      appJson.expo.android.versionCode = newBuildNumber;
    }
    console.log(`✅ Updated Android versionCode to ${newBuildNumber}`);
  }
  
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log(`✅ Updated app.json version to ${newVersionString}`);
}

// Success message
console.log(`✅ Version updated: ${currentMajor}.${currentMinor}.${currentPatch} (${currentBuildNumber}) -> ${newMajor}.${newMinor}.${newPatch} (${newBuildNumber})`); 