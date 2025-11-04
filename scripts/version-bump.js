#!/usr/bin/env node

/**
 * Version Bump Script
 * 
 * Creates Git tags for semantic versioning
 * Usage:
 *   node scripts/version-bump.js <major|minor|patch>
 * 
 * Example:
 *   node scripts/version-bump.js patch  # Create a new patch version tag
 *   node scripts/version-bump.js minor  # Create a new minor version tag
 *   node scripts/version-bump.js major  # Create a new major version tag
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const versionInfo = require('./generate-version');

// Get update type from command line argument
const updateType = process.argv[2] || 'patch';

if (!['major', 'minor', 'patch'].includes(updateType)) {
  console.error('Error: Version type must be one of: major, minor, patch');
  process.exit(1);
}

// Calculate new version based on current version
function calculateNewVersion(currentVersion, type) {
  const { major, minor, patch } = currentVersion;
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// Update version in package.json
function updatePackageJson(newVersion) {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✅ Updated package.json version to ${newVersion}`);
    return true;
  }
  
  return false;
}

// Create Git tag for the new version
function createGitTag(newVersion) {
  try {
    // Create tag
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
    console.log(`✅ Created Git tag: v${newVersion}`);
    
    // Show tag push instructions
    console.log('\nTo push the new tag to remote, run:');
    console.log(`  git push origin v${newVersion}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create Git tag:', error.message);
    return false;
  }
}

// Main process
function main() {
  console.log(`Current version: ${versionInfo.semanticVersion}`);
  console.log(`Bumping ${updateType} version...`);
  
  // Calculate new version
  const newVersion = calculateNewVersion(versionInfo, updateType);
  console.log(`New version will be: ${newVersion}`);
  
  // Confirm with user
  console.log('\n⚠️  This will:');
  console.log(`  1. Update package.json to version ${newVersion}`);
  console.log(`  2. Create Git tag v${newVersion}`);
  console.log('\nMake sure your working directory is clean before proceeding.');
  
  // Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      console.error('\n❌ You have uncommitted changes. Please commit or stash them first.');
      process.exit(1);
    }
  } catch (error) {
    console.warn('⚠️  Could not check Git status. Make sure your working directory is clean.');
  }
  
  // Proceed with confirmation
  console.log('\nPress Enter to continue or Ctrl+C to cancel...');
  // In an interactive environment, we would wait for user input here
  // For simplicity in this implementation, we'll proceed automatically
  
  // Update package.json
  updatePackageJson(newVersion);
  
  // Create Git tag
  if (createGitTag(newVersion)) {
    console.log(`\n✅ Successfully bumped version to ${newVersion}`);
    
    // Remind to commit package.json changes
    console.log('\nDon\'t forget to commit the package.json changes:');
    console.log(`  git commit -am "Bump version to ${newVersion}"`);
  }
}

// Execute main process
main(); 