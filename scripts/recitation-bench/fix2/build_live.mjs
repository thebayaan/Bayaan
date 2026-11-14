/* eslint-env node, es2020 */
// Compiles the live check's TypeScript (reading, laying and check under
// services/recitation/liveCheck, or a copy of those three files elsewhere) into one
// folder of .mjs files for node, named by the files' hash, and returns check.mjs's path.
//
//   node build_live.mjs [<source dir>] [<out dir>]
//   node build_live.mjs --snapshot <dir> [<source dir>]    (copies the three .ts files)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {OUT, ROOT} from './common.mjs';

const require = createRequire(path.join(ROOT, 'package.json'));
const ts = require('typescript');
export const LIVE_FILES = ['reading', 'laying', 'check'];
export const LIVE_SRC = path.join(ROOT, 'services/recitation/liveCheck');

export function buildLive(srcDir = LIVE_SRC, outDir = undefined) {
  const hash = crypto.createHash('sha256');
  const code = {};
  for (const f of LIVE_FILES) {
    code[f] = fs.readFileSync(path.join(srcDir, `${f}.ts`), 'utf8');
    hash.update(code[f]);
  }
  const sha = hash.digest('hex');
  const out = outDir ?? path.join(OUT, 'live.build', sha.slice(0, 12));
  fs.mkdirSync(out, {recursive: true});
  for (const f of LIVE_FILES) {
    const js = ts
      .transpileModule(code[f], {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
      })
      .outputText.replace(/from '\.\/(reading|laying)'/g, "from './$1.mjs'");
    // Other processes may be importing this file now: leave it alone when it is the
    // same, and never truncate it in place.
    const file = path.join(out, `${f}.mjs`);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== js) {
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, js);
      fs.renameSync(tmp, file);
    }
  }
  return {file: path.join(out, 'check.mjs'), sha};
}

/** Copies the three source files into `dir`, so a run set keeps the check it ran. */
export function snapshotLive(dir, srcDir = LIVE_SRC) {
  fs.mkdirSync(dir, {recursive: true});
  for (const f of LIVE_FILES) {
    fs.copyFileSync(path.join(srcDir, `${f}.ts`), path.join(dir, `${f}.ts`));
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === '--snapshot') {
    snapshotLive(a, b);
  } else {
    console.log(JSON.stringify(buildLive(cmd, a)));
  }
}
