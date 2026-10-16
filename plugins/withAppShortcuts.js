// plugins/withAppShortcuts.js
// Adds plugins/app-shortcuts/BayaanAppShortcuts.swift to the main app target
// (never the widget extension), so it survives `expo prebuild --clean`.
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
} = require('@expo/config-plugins');

const FILE_NAME = 'BayaanAppShortcuts.swift';
const SOURCE = path.join(__dirname, 'app-shortcuts', FILE_NAME);

function withAppShortcuts(config) {
  const copied = withDangerousMod(config, [
    'ios',
    async cfg => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(
        cfg.modRequest.projectRoot,
      );
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        projectName,
        FILE_NAME,
      );
      fs.copyFileSync(SOURCE, dest);
      return cfg;
    },
  ]);
  return withXcodeProject(copied, cfg => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      cfg.modRequest.projectRoot,
    );
    const filepath = `${projectName}/${FILE_NAME}`;
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: cfg.modResults,
      });
    }
    return cfg;
  });
}

module.exports = withAppShortcuts;
