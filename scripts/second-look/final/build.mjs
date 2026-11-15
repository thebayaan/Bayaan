/* eslint-env node, es2020 */
// Bundles the app's real modules for node: the service, wordMarks, sessionRunner,
// secondLook and addedWord, once for each way the owner can set the switches in
// secondLook/config.ts. app.* play back a recorded follower; real.* hold the app's own
// engine wrapper over @tilawa/core in node_modules, with the options the app passes.
// Only native edges are swapped (../repro/shims/native.mjs). Two things are added at
// bundle time and change nothing the app does: a tap on what the wrapper reports, and a
// way to start a take in the correction state on a passage the suite names.
//   node scripts/second-look/final/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(
  ROOT,
  'scripts/recitation-bench/.out/second-look/final/bundles',
);
const require = createRequire(path.join(ROOT, 'package.json'));
const esbuild = require('esbuild');

const NATIVE = path.join(HERE, '../repro/shims/native.mjs');
const TILAWA = path.join(HERE, 'shim_tilawa.mjs');
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
const CONFIGS = {
  off: {SECOND_LOOK_ENABLED: 'false'},
  s1: {},
  s2: {JUDGE_STEP: '2'},
  s1s: {CANCEL_MAY_CANCEL: "'skipped'"},
  s2s: {JUDGE_STEP: '2', CANCEL_MAY_CANCEL: "'skipped'"},
};
const SIGNATURE = `export async function createRecitationEngine(
  assets: RecitationAssetPaths,
  onEvent: (msg: EngineMessage) => void,
): Promise<RecitationEngine> {`;

function plugin(flips, realEngine) {
  return {
    name: 'edges',
    setup(build) {
      build.onResolve({filter: /.*/}, args => {
        if (SWAPPED.has(args.path)) return {path: NATIVE};
        if (args.path === './recitationEngine' && !realEngine)
          return {path: NATIVE};
        if (args.path === '@tilawa/core' && !args.importer.endsWith(TILAWA))
          return {path: TILAWA};
        if (args.path.startsWith('@/')) {
          const base = path.join(ROOT, args.path.slice(2));
          for (const ext of ['', '.ts', '.tsx', '.json', '.js']) {
            if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile())
              return {path: base + ext};
          }
        }
        return null;
      });
      build.onLoad({filter: /RecitationTrackingService\.ts$/}, args => ({
        contents: `${fs.readFileSync(args.path, 'utf8')}
export const inDoubtForReplay = () => ({book, judgeWaiting});
export const correctionForReplay = (expected: ExpectedPassage) => {
  if (!memo) return;
  memo.expected = expected;
  memo.correction = true;
  memo.checked = true;
};
`,
        loader: 'ts',
      }));
      build.onLoad(
        {filter: /services\/recitation\/recitationEngine\.ts$/},
        args => {
          const text = fs.readFileSync(args.path, 'utf8');
          if (!text.includes(SIGNATURE))
            throw new Error('wrapper signature moved');
          return {
            contents: text.replace(
              SIGNATURE,
              `${SIGNATURE}
  {
    const heard = onEvent;
    onEvent = msg => {
      (globalThis as any).__repro.tap?.(msg);
      heard(msg);
    };
  }`,
            ),
            loader: 'ts',
          };
        },
      );
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

const bundles = [
  ...Object.entries(CONFIGS).map(([n, f]) => [`app.${n}.mjs`, f, false]),
  ...['off', 's1', 's2'].map(n => [`real.${n}.mjs`, CONFIGS[n], true]),
];
fs.mkdirSync(OUT, {recursive: true});
for (const [file, flips, realEngine] of bundles) {
  await esbuild.build({
    entryPoints: [path.join(HERE, '../repro/entry.ts')],
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
console.log(`built ${bundles.map(b => b[0]).join(', ')}`);
