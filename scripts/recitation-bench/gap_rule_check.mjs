/* eslint-env node, es2020 */
// Checks the patched engine's ayah-gap rule after a deferred skipped-ayah
// flag, without the model (a few milliseconds):
//
//   node scripts/recitation-bench/gap_rule_check.mjs
//
// The reader skips 78:9. The tracker bends 78:10's audio onto 78:9's text,
// the skip check flags 78:9 and the app defers the flag at once. The tracker
// it keeps (keepContextOnDefer) then matches 78:9 from that audio, and next
// 78:11. The gap rule (an ayah never matched between two matched ones) must
// not read 78:8 > 78:9 > 78:11 as a second skip, of 78:10: on the planted
// bench that false flag followed real skips among the look-alike ayat of
// An-Naba'. TILAWA_DIST=<dir> checks another build, as in bench.mjs.
import path from 'node:path';
import {createRequire} from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const dist =
  process.env.TILAWA_DIST ??
  path.resolve(HERE, '../../node_modules/@tilawa/core/dist');
globalThis.require = createRequire(path.join(dist, 'recitation/session.js'));
const {ZipformerSession} = await import(
  path.join(dist, 'recitation/session.js')
);
const {CorrectionController} = await import(
  path.join(dist, 'recitation/correction.js')
);

/** A session with only the state these rules read, as its constructor sets
 *  it, and stand-ins for what correct() rebuilds when it does not keep the
 *  tracker. */
function session(keepContextOnDefer) {
  const s = Object.create(ZipformerSession.prototype);
  Object.assign(s, {
    keepContextOnDefer,
    keptSkips: new Set(),
    lastMatch: null,
    lastCursor: {surah: 78, ayah: 8, word: 0},
    stopping: false,
    expected: {surah: 78, ayah: 6, ayahEnd: 15},
    emitted: new Set(),
    ayahIssuesRaised: new Set(),
    accumulated: new Map(),
    correction: new CorrectionController(),
    engine: {tracer: null, tracker: null, skippedAyah: () => null},
    decoder: {framesDecoded: 0},
    corpus: {ayahFirstWord: (_surah, ayah) => ayah * 100},
    skipCandidate: null,
    structuralRules: null,
    onEvent: null,
    wordCount: () => 3,
    resetDecoder: () => undefined,
    makeEngine: () => ({
      tracer: null,
      tracker: null,
      skippedAyah: () => null,
      track: () => undefined,
    }),
  });
  s.correction.setMode('correction');
  return s;
}

/** The flags raised in `out`, each answered with review_later as the app
 *  does. */
function flagsOf(s, out) {
  const flags = out
    .filter(m => m.type === 'correction' && m.state.phase === 'error')
    .map(({state: {issue}}) => `${issue.kind} ${issue.surah}:${issue.ayah}`);
  if (flags.length > 0) s.correct('review_later');
  return flags;
}

/** As emitNewMatches: the ayah is matched, then the gap rule runs. */
function match(s, ayah) {
  s.emitted.add(`78:${ayah}`);
  return flagsOf(s, s.checkAyahGap({surah: 78, ayah}));
}

/** As checkSkippedAyah when the tracker reads `ayah`'s audio as the next
 *  ayah. */
function skipCheck(s, ayah) {
  s.engine.skippedAyah = () => ({surah: 78, ayah});
  const out = s.checkSkippedAyah(true);
  s.engine.skippedAyah = () => null;
  return flagsOf(s, out);
}

function flagsFor(keepContextOnDefer, steps) {
  const s = session(keepContextOnDefer);
  return steps.flatMap(([step, ayah]) =>
    step === 'skip' ? skipCheck(s, ayah) : match(s, ayah),
  );
}

let failed = 0;
function expectFlags(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`,
  );
}

const skipped = 'possible_skipped_ayah';
const bentSkip = [
  ['match', 8],
  ['skip', 9],
  ['match', 9],
  ['match', 11],
];
expectFlags(
  'one skipped ayah raises one flag, though the kept tracker matches it',
  flagsFor(true, bentSkip),
  [`${skipped} 78:9`],
);
expectFlags(
  'a later skip is still flagged',
  flagsFor(true, [...bentSkip, ['match', 13]]),
  [`${skipped} 78:9`, `${skipped} 78:12`],
);
expectFlags(
  'a gap with no flag before it is still flagged',
  flagsFor(true, [
    ['match', 8],
    ['match', 10],
  ]),
  [`${skipped} 78:9`],
);
expectFlags(
  'the next ayah matched after the bent match raises nothing more',
  flagsFor(true, [
    ['match', 8],
    ['skip', 9],
    ['match', 9],
    ['match', 10],
  ]),
  [`${skipped} 78:9`],
);
expectFlags(
  'with keepContextOnDefer off the rule is as before',
  flagsFor(false, bentSkip),
  [`${skipped} 78:9`, `${skipped} 78:10`],
);
console.log(failed > 0 ? `${failed} failed` : 'all passed');
process.exit(failed > 0 ? 1 : 0);
