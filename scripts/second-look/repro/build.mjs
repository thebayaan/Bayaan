/* eslint-env node, es2020 */
// Bundles the app's real modules for node, once for each way the owner can set the
// switches in secondLook/config.ts, by changing exactly that one line. The native edges
// become shims/native.mjs. Time and timers become the replay's clock (clock.mjs).
// `real` also bundles the app's engine wrapper over the real @tilawa/core, for
// real_engine.mjs.
//   node scripts/second-look/repro/build.mjs [real]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'scripts/recitation-bench/.out/second-look/repro');
const require = createRequire(path.join(ROOT, 'package.json'));
const esbuild = require('esbuild');

const NATIVE = path.join(HERE, 'shims/native.mjs');
const SWAPPED = new Set([
  'react-native',
  'expo-haptics',
  'onnxruntime-react-native',
  '@/i18n',
  '@/services/analytics/AnalyticsService',
  '@/store/mushafSettingsStore',
  '@/services/player/store/playerStore',
  '@/store/mushafPlayerStore',
  '@/services/mushaf/DigitalKhattDataService',
  './RecitationLogDatabase',
  './debugTake',
  '../debugTake',
  './micStream',
  './recitationAssets',
  '../recitationAssets',
  'expo-file-system/legacy',
]);
const PLAYBACK = new Set(['./recitationEngine']);
const TILAWA = path.join(HERE, 'shims/tilawa.mjs');

export const CONFIGS = {
  off: {SECOND_LOOK_ENABLED: 'false'},
  s1: {},
  s2: {JUDGE_STEP: '2'},
  s1s: {CANCEL_MAY_CANCEL: "'skipped'"},
  s2s: {JUDGE_STEP: '2', CANCEL_MAY_CANCEL: "'skipped'"},
};

function plugin(flips, realEngine) {
  return {
    name: 'edges',
    setup(build) {
      build.onResolve({filter: /.*/}, args => {
        if (SWAPPED.has(args.path)) return {path: NATIVE};
        if (PLAYBACK.has(args.path) && !realEngine) return {path: NATIVE};
        if (
          args.path === '@tilawa/core' &&
          !args.importer.endsWith('tilawa.mjs')
        ) {
          return {path: TILAWA};
        }
        if (args.path.startsWith('@/')) {
          const base = path.join(ROOT, args.path.slice(2));
          for (const ext of ['', '.ts', '.tsx', '.json', '.js']) {
            if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
              return {path: base + ext};
            }
          }
        }
        return null;
      });
      // For the bench's made-up next word only: which ayat have a word still in doubt.
      build.onLoad({filter: /RecitationTrackingService\.ts$/}, args => ({
        contents: `${fs.readFileSync(args.path, 'utf8')}
export const inDoubtForReplay = () => ({book, judgeWaiting});
`,
        loader: 'ts',
      }));
      build.onLoad({filter: /secondLook\/config\.ts$/}, args => {
        let text = fs.readFileSync(args.path, 'utf8');
        for (const [name, value] of Object.entries(flips)) {
          const line = new RegExp(`(export const ${name} = )[^;]+( as [^;]+;)`);
          if (!line.test(text)) throw new Error(`no line for ${name}`);
          text = text.replace(line, `$1${value}$2`);
        }
        return {contents: text, loader: 'ts'};
      });
    },
  };
}

const bundles = Object.entries(CONFIGS).map(([name, flips]) => [
  `app.${name}.mjs`,
  flips,
  false,
]);
if (process.argv.includes('real')) {
  for (const name of ['s1', 's2']) {
    bundles.push([`real.${name}.mjs`, CONFIGS[name], true]);
  }
}
fs.mkdirSync(OUT, {recursive: true});
for (const [file, flips, realEngine] of bundles) {
  await esbuild.build({
    entryPoints: [path.join(HERE, 'entry.ts')],
    outfile: path.join(OUT, file),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'warning',
    plugins: [plugin(flips, realEngine)],
    banner: {
      js: "import {createRequire as __cr} from 'node:module'; const require = __cr(import.meta.url);",
    },
    define: {
      __DEV__: 'true',
      'process.env.NODE_ENV': '"production"',
      setTimeout: '__vclock.setTimeout',
      clearTimeout: '__vclock.clearTimeout',
      setInterval: '__vclock.setInterval',
      clearInterval: '__vclock.clearInterval',
      'Date.now': '__vclock.now',
      'performance.now': '__vclock.now',
    },
  });
}
console.log(`built ${bundles.map(b => b[0]).join(', ')} in ${OUT}`);
