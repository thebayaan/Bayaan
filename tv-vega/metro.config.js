const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * tv-vega is a thin Vega host for the shared TV app in ../tv-app. Metro
 * bundles tv-app's screens directly; Vega-only behavior lives next to the
 * shared code as *.kepler.ts(x) files, which Metro prefers when bundling for
 * the `kepler` platform.
 */

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');
const tvAppRoot = path.join(repoRoot, 'tv-app');

// Shared code imports upstream package names; on Vega they map to Amazon's ports.
const VEGA_PORTS = {
  '@react-native-async-storage/async-storage':
    '@amazon-devices/react-native-async-storage__async-storage',
  '@shopify/flash-list': '@amazon-devices/shopify__flash-list',
  'react-native-svg': '@amazon-devices/react-native-svg',
  // Vega's expo-image port crashes on render; see shims/expo-image.tsx.
  'expo-image': path.join(__dirname, 'shims', 'expo-image.tsx'),
};

const KEPLER_RN = '@amazon-devices/react-native-kepler';

// The CLI only applies its react-native -> Kepler rename to the default
// resolver; a custom resolveRequest replaces it, so apply the rename here.
function toKeplerReactNative(moduleName, platform) {
  if (platform !== 'kepler') return moduleName;
  if (moduleName === 'react-native') return KEPLER_RN;
  if (moduleName.startsWith('react-native/')) {
    return `${KEPLER_RN}/${moduleName.slice('react-native/'.length)}`;
  }
  return moduleName;
}

function toVegaPort(moduleName) {
  for (const [upstream, port] of Object.entries(VEGA_PORTS)) {
    if (moduleName === upstream) return port;
    if (moduleName.startsWith(`${upstream}/`)) {
      return port + moduleName.slice(upstream.length);
    }
  }
  return moduleName;
}

function isBareImport(moduleName) {
  return !moduleName.startsWith('.') && !path.isAbsolute(moduleName);
}

const hostEntry = path.join(projectRoot, 'index.js');
const hostNodeModules = path.join(projectRoot, 'node_modules');

const config = {
  // Only the folders the TV app reads from, not the whole repo (and its
  // multi-GB node_modules).
  watchFolders: [
    tvAppRoot,
    path.join(repoRoot, 'components'),
    path.join(repoRoot, 'data'),
    path.join(repoRoot, 'utils'),
    path.join(repoRoot, 'assets'),
  ],
  resolver: {
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json'],
    blockList: [
      /tv-app[/\\](node_modules|android|ios|__tests__)[/\\].*/,
      /.*\.test\.tsx?$/,
    ],
    resolveRequest: (context, requested, platform) => {
      const moduleName = toKeplerReactNative(requested, platform);
      // The mobile app's `@/` alias (used by utils/reciterImages).
      if (moduleName.startsWith('@/')) {
        return context.resolveRequest(
          context,
          path.join(repoRoot, moduleName.slice(2)),
          platform,
        );
      }
      const origin = context.originModulePath;
      if (isBareImport(moduleName) && !origin.startsWith(hostNodeModules)) {
        // Resolve packages imported by shared code from tv-vega's
        // node_modules, never from tv-app's (react-native-tvos, expo).
        return context.resolveRequest(
          {...context, originModulePath: hostEntry},
          toVegaPort(moduleName),
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
