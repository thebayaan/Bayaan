const {withDangerousMod} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// This is the signingConfigs block content we want to ensure exists
const androidSigningConfigsBlock = `
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('BAYAAN_UPLOAD_STORE_FILE')) {
                storeFile file(project.properties['BAYAAN_UPLOAD_STORE_FILE'])
                storePassword System.getenv('BAYAAN_UPLOAD_STORE_PASSWORD') ?: project.properties['BAYAAN_UPLOAD_STORE_PASSWORD']
                keyAlias System.getenv('BAYAAN_UPLOAD_KEY_ALIAS') ?: project.properties['BAYAAN_UPLOAD_KEY_ALIAS'] ?: 'upload'
                keyPassword System.getenv('BAYAAN_UPLOAD_KEY_PASSWORD') ?: project.properties['BAYAAN_UPLOAD_KEY_PASSWORD']
            } else {
                println "WARNING: Release signing config 'BAYAAN_UPLOAD_STORE_FILE' not found in gradle.properties or environment variables. App will not be signed for release using custom keystore."
                // Fall back to debug signing
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }`;

// This function modifies the build.gradle content
function applySigningConfigLogic(buildGradleContent) {
  let newContent = buildGradleContent;

  // First, remove any existing 'apply from: file("../signing.gradle")' line
  const applyFromFileRegex =
    /apply from: file\(['"]\.\.\/signing\.gradle['"]\)\s*\n?/g;
  if (applyFromFileRegex.test(newContent)) {
    newContent = newContent.replace(
      applyFromFileRegex,
      '// Removed by withAndroidSigning plugin: apply from: file("../signing.gradle")\n',
    );
    console.log(
      'withAndroidSigning Plugin: Removed legacy \'apply from: file("../signing.gradle")\'.',
    );
  }

  // Find the android block
  const androidBlockRegex = /android\s*{/;
  const androidBlockMatch = androidBlockRegex.exec(newContent);

  if (!androidBlockMatch) {
    console.warn(
      "withAndroidSigning Plugin: Could not find 'android {' block in app/build.gradle. Signing configuration not applied.",
    );
    return newContent; // Return original content if anchor not found
  }

  // Check if signingConfigs exists but doesn't have a release config
  const hasSigningConfigs =
    newContent.includes('signingConfigs {') ||
    newContent.includes('signingConfigs{');
  const hasReleaseConfig =
    newContent.includes('signingConfigs {') &&
    newContent.includes('release {') &&
    newContent.includes('BAYAAN_UPLOAD_STORE_FILE');

  // Replace the entire signingConfigs block if it exists but doesn't have our release config
  if (hasSigningConfigs && !hasReleaseConfig) {
    const signingConfigsBlockRegex =
      /signingConfigs\s*{[^}]*debug[^}]*}(?:[^}]*})?/s;
    newContent = newContent.replace(
      signingConfigsBlockRegex,
      androidSigningConfigsBlock,
    );
    console.log(
      'withAndroidSigning Plugin: Updated signingConfigs block with release configuration.',
    );
  }
  // Add signingConfigs block if it doesn't exist
  else if (!hasSigningConfigs) {
    const insertIndex = androidBlockMatch.index + androidBlockMatch[0].length;
    newContent =
      newContent.slice(0, insertIndex) +
      androidSigningConfigsBlock +
      newContent.slice(insertIndex);
    console.log(
      'withAndroidSigning Plugin: Added signingConfigs block with release configuration.',
    );
  }

  // Fix the release build type section to remove any duplicate signing config lines
  const releaseBlockRegex = /(buildTypes\s*{[\s\S]*?release\s*{)([\s\S]*?)(})/;
  const releaseBlockMatch = releaseBlockRegex.exec(newContent);

  if (releaseBlockMatch) {
    let releaseBlockContent = releaseBlockMatch[2];

    // Count occurrences of signingConfig in the release block
    const signingConfigCount = (
      releaseBlockContent.match(
        /signingConfig\s+signingConfigs\.[a-zA-Z0-9_]+/g,
      ) || []
    ).length;

    if (signingConfigCount > 1) {
      // Remove all signingConfig lines
      releaseBlockContent = releaseBlockContent.replace(
        /\s*signingConfig\s+signingConfigs\.[a-zA-Z0-9_]+\s*/g,
        '\n',
      );

      // Add back just one correct one
      releaseBlockContent =
        '\n            signingConfig signingConfigs.release' +
        releaseBlockContent;

      // Reassemble the block
      newContent = newContent.replace(
        releaseBlockRegex,
        `$1${releaseBlockContent}$3`,
      );

      console.log(
        'withAndroidSigning Plugin: Fixed duplicate signingConfig in release build type.',
      );
    } else if (signingConfigCount === 0) {
      // If there are no signingConfig lines, add one
      const newReleaseContent =
        '\n            signingConfig signingConfigs.release' +
        releaseBlockContent;

      newContent = newContent.replace(
        releaseBlockRegex,
        `$1${newReleaseContent}$3`,
      );

      console.log(
        'withAndroidSigning Plugin: Added missing signingConfig to release build type.',
      );
    } else if (
      releaseBlockContent.includes('signingConfig signingConfigs.debug')
    ) {
      // Replace debug with release
      newContent = newContent.replace(
        /signingConfig\s+signingConfigs\.debug/g,
        'signingConfig signingConfigs.release',
      );

      console.log(
        'withAndroidSigning Plugin: Changed debug signing config to release for release build type.',
      );
    }
  } else {
    console.warn(
      'withAndroidSigning Plugin: Could not find release build type block in app/build.gradle.',
    );
  }

  return newContent;
}

const withAndroidSigning = config => {
  return withDangerousMod(config, [
    'android',
    async expoConfig => {
      const projectRoot = expoConfig.modRequest.projectRoot;
      const buildGradlePath = path.join(
        projectRoot,
        'android',
        'app',
        'build.gradle',
      );

      try {
        let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');
        buildGradleContent = applySigningConfigLogic(buildGradleContent);
        fs.writeFileSync(buildGradlePath, buildGradleContent);
      } catch (error) {
        let errorMessage = 'An unknown error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        console.error(
          `withAndroidSigning Plugin: Error modifying android/app/build.gradle: ${errorMessage}`,
        );
        throw error; // Re-throw to halt the build process
      }

      return expoConfig;
    },
  ]);
};

module.exports = withAndroidSigning;
