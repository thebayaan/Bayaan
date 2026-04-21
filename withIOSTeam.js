const {withXcodeProject} = require('@expo/config-plugins');

// Apple Developer Team ID. Forks override via APPLE_TEAM_ID env var (must
// match the value used in app.config.js).
const TEAM_ID = process.env.APPLE_TEAM_ID ?? 'S4W5Q2L53W';

const withIOSTeam = config => {
  // eslint-disable-next-line no-shadow
  return withXcodeProject(config, async config => {
    const xcodeProject = config.modResults;

    // Get the main app target
    const mainTargetUUID = xcodeProject.getFirstTarget().uuid;

    // For each build configuration (Debug, Release)
    const buildConfigSection = xcodeProject.pbxXCBuildConfigurationSection();

    // Iterate through build configurations and set DEVELOPMENT_TEAM
    Object.keys(buildConfigSection).forEach(configName => {
      const buildConfig = buildConfigSection[configName];

      // Only modify build settings for the main target
      if (
        buildConfig.buildSettings &&
        buildConfig.buildSettings.PRODUCT_NAME &&
        typeof buildConfig.name !== 'undefined'
      ) {
        // Set the team ID
        buildConfig.buildSettings.DEVELOPMENT_TEAM = TEAM_ID;

        console.log(
          `withIOSTeam: Set DEVELOPMENT_TEAM to ${TEAM_ID} for ${buildConfig.name} configuration`,
        );
      }
    });

    // Also update TargetAttributes to ensure the team ID is preserved
    const proj = xcodeProject.getFirstProject();
    if (
      proj &&
      proj.firstProject &&
      proj.firstProject.attributes &&
      proj.firstProject.attributes.TargetAttributes
    ) {
      const targetAttributes = proj.firstProject.attributes.TargetAttributes;

      if (targetAttributes[mainTargetUUID]) {
        targetAttributes[mainTargetUUID].DevelopmentTeam = TEAM_ID;
        console.log(
          `withIOSTeam: Set DevelopmentTeam to ${TEAM_ID} in TargetAttributes`,
        );
      }
    }

    return config;
  });
};

module.exports = withIOSTeam;
