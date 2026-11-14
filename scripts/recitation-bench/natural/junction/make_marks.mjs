/* eslint-env node, es2020 */
// Writes the app's mark rules with the junction rule added, for WORD_MARKS, to
// .out/natural/junction/wordMarks.junction.ts. services/ stays untouched; each
// edit must match the current file exactly, or this stops.
//
// The rule: a last word the engine's junction check finds unsaid is a 'missed'
// suspect, followed and confirmed already, since the check ran on the next word and
// is not a one-chunk flicker: it shows at once. One the check finds said is not a mark
// even if the engine said 'skipped'.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(HERE, '../..');
const ROOT = path.resolve(BENCH, '../..');
const SRC = path.join(ROOT, 'services/recitation/wordMarks.ts');
// The file the scores in frozen*.json used stays as it was; this one follows services/.
const OUT = path.join(BENCH, '.out/natural/junction/wordMarks.junction.current.ts');

let src = fs.readFileSync(SRC, 'utf8');
const edits = [
  [
    `  /** Normalised distance between the heard and expected sounds. */
  distance?: number | null;
}
`,
    `  /** Normalised distance between the heard and expected sounds. */
  distance?: number | null;
  /**
   * The engine's junction check on an ayah's last word, once the next ayah has
   * started: true when the word was not said, false when it was.
   */
  junctionMissing?: boolean | null;
}
`,
  ],
  [
    `function suspectKind(change: VerdictChange): MarkKind | null {
  const gop = change.detail?.gop;
`,
    `function suspectKind(change: VerdictChange): MarkKind | null {
  const junction = change.detail?.junctionMissing;
  if (junction === true) return 'missed';
  if (junction === false && change.state === 'skipped') return null;
  const gop = change.detail?.gop;
`,
  ],
  [
    `      if (
        kind &&
        (!mark || mark.status === 'corrected' || mark.status === 'noted')
      ) {
        write(key, {...fresh, kind, status: 'suspect'});
      } else if (kind && mark?.status === 'suspect') {
        write(key, {...mark, kind, ...lastBad});
      } else if (mark) {
`,
    `      // The check ran on the next word: the reader has carried on, and it is no
      // flicker, so the mark is due now.
      const carriedOn =
        change.detail?.junctionMissing === true
          ? {followedAt: now, since: now - MARK_CONFIRM_MS}
          : {};
      if (change.detail?.junctionMissing === false && mark?.status === 'suspect') {
        write(key, noted(mark, now));
      } else if (
        kind &&
        (!mark || mark.status === 'corrected' || mark.status === 'noted')
      ) {
        write(key, {...fresh, kind, status: 'suspect', ...carriedOn});
      } else if (kind && mark?.status === 'suspect') {
        write(key, {...mark, kind, ...lastBad, ...carriedOn});
      } else if (mark) {
`,
  ],
];
for (const [from, to] of edits) {
  if (!src.includes(from)) throw new Error(`wordMarks.ts has changed: ${from.slice(0, 80)}`);
  src = src.replace(from, to);
}
fs.writeFileSync(OUT, src);
console.log('wrote', OUT);

// The simplest alternative, for comparison: drop the edge rule on an ayah's last word,
// so 'wrong' there is a suspect like any other, with the next-word rule still on.
const noEdge = fs.readFileSync(SRC, 'utf8');
const edge = `  return change.word <= 0 || change.word >= change.totalWords - 1;
`;
if (!noEdge.includes(edge)) throw new Error('wordMarks.ts has changed: isBoundary');
fs.writeFileSync(
  path.join(BENCH, '.out/natural/junction/wordMarks.noedge.ts'),
  noEdge.replace(edge, `  return change.word <= 0;
`),
);
