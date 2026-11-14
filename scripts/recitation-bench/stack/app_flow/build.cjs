/* eslint-env node, es2020 */
// Compiles the app's engine wrapper, rule and mark rules for node, with the native edges
// swapped: onnxruntime-node for onnxruntime-react-native, plain fs for expo-file-system.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const ts = require(path.join(ROOT, 'node_modules/typescript'));
const OUT = path.resolve(
  ROOT,
  'scripts/recitation-bench/.out/engine-stack/app_flow',
);
fs.mkdirSync(OUT, {recursive: true});
for (const shim of [
  'shim_fs.mjs',
  'shim_ort.mjs',
  'shim_tilawa.mjs',
  'run.mjs',
]) {
  fs.copyFileSync(path.join(__dirname, shim), path.join(OUT, shim));
}
const compile = (f, name, edits) => {
  let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const [a, b] of edits) {
    if (!src.includes(a)) throw new Error(`${f}: no ${a}`);
    src = src.replace(a, b);
  }
  fs.writeFileSync(
    path.join(OUT, name),
    ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
};
const npl = [`'./followerConstants.npl.json'`, `'${OUT}/constants.mjs'`];
fs.writeFileSync(
  path.join(OUT, 'constants.mjs'),
  `export default ${fs.readFileSync(path.join(ROOT, 'services/recitation/followerConstants.npl.json'), 'utf8')}`,
);
compile('services/recitation/addedWord.ts', 'addedWord.mjs', [npl]);
compile('services/recitation/wordMarks.ts', 'wordMarks.mjs', [npl]);
compile('services/recitation/recitationEngine.ts', 'recitationEngine.mjs', [
  npl,
  [`'./addedWord'`, `'${OUT}/addedWord.mjs'`],
  [`'expo-file-system/legacy'`, `'${OUT}/shim_fs.mjs'`],
  [`'onnxruntime-react-native'`, `'${OUT}/shim_ort.mjs'`],
  [`'@tilawa/core'`, `'${OUT}/shim_tilawa.mjs'`],
]);
