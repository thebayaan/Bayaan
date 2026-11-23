/* eslint-env node, es2020 */
// Copies the app's patched @tilawa/core dist to .out/natural/junction/dist and adds
// the junction check, for TILAWA_DIST. node_modules and patches/ stay untouched.
//
//   node natural/junction/make_dist.mjs
//   TILAWA_DIST=.out/natural/junction/dist \
//   ENGINE_OPTS='{"junction":{"llrMissing":-7,"fitNext":-4,"fitLate":-20}}' node bench.mjs ...
//
// Off unless ENGINE_OPTS passes `junction`: the copy then behaves as the original.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '../..');
const ROOT = path.resolve(BENCH, '../..');
const SRC = path.join(ROOT, 'node_modules/@tilawa/core/dist');
const OUT = path.join(BENCH, '.out/natural/junction/dist');

fs.rmSync(OUT, {recursive: true, force: true});
fs.cpSync(SRC, OUT, {recursive: true});
fs.copyFileSync(path.join(HERE, 'engine_junction.js'), path.join(OUT, 'recitation/junction.js'));

const file = path.join(OUT, 'recitation/session.js');
let src = fs.readFileSync(file, 'utf8');
const edits = [
  [
    'import { CorrectionController } from "./correction.js";\n',
    'import { CorrectionController } from "./correction.js";\nimport { JunctionCheck } from "./junction.js";\n',
  ],
  [
    '        this.engine = this.makeEngine();\n    }\n    static async create(opts) {',
    '        this.engine = this.makeEngine();\n        this.junction = opts.junction ? new JunctionCheck(this.corpus, opts.junction) : null;\n    }\n    static async create(opts) {',
  ],
  [
    '        const engine = this.practiceEngine ?? this.engine;\n        return engine.tracer?.verdicts(false) ?? [];\n',
    '        const engine = this.practiceEngine ?? this.engine;\n        const out = engine.tracer?.verdicts(false) ?? [];\n        if (this.junction && !this.practiceEngine && engine.tracer && this.correction.mode === "correction") {\n            return this.junction.apply(engine.tracer, this.posteriors, this.decoder.framesDecoded, out);\n        }\n        return out;\n',
  ],
];
for (const [from, to] of edits) {
  if (!src.includes(from)) throw new Error(`session.js has changed: ${from}`);
  src = src.replace(from, to);
}
fs.writeFileSync(file, src);
console.log('wrote', OUT);
