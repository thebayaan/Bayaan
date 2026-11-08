/* eslint-env node, es2020 */
// The app's own engine wrapper and mark rules on real audio, in the app's flow: what
// RecitationTrackingService does at a lock, with time taken from the audio. Compare the
// change stream and the marks with the same clip's bench run through cmp.mjs.
//   node stack/app_flow/build.cjs
//   node .out/engine-stack/app_flow/run.mjs <manifest.json> <out.jsonl>
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.dirname(new URL(import.meta.url).pathname);
const BENCH = path.resolve(OUT, '../../..');
const {createRecitationEngine} = await import(`${OUT}/recitationEngine.mjs`);
const marks = await import(`${OUT}/wordMarks.mjs`);
const {held} = await import(`${OUT}/shim_tilawa.mjs`);
const [manifest, outFile] = process.argv.slice(2);
const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45,
  83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];
const surahLength = s => AYAH_COUNTS[s - 1] ?? 1;
const PASSAGE_AYAT = 10;
const SLIDE_WITHIN = 3;
const CHUNK = 7680;
const SR = 16000;
const UNLOCK = new Set(['lost', 'idle', 'locateFailed', 'completed']);
const LOCK = new Set(['located', 'relocated']);
const FALLBACK = new Set(['idle', 'lost', 'locateFailed', 'completed']);
let listener = () => undefined;
const engine = await createRecitationEngine(
  {
    modelPath: path.join(BENCH, '.out/assets/zipformer_a0w_ep1_a05.int8.onnx'),
    corpusPath: path.join(BENCH, '.out/assets/zipformer_quran.json'),
  },
  msg => listener(msg),
);
// Lets the vocabulary finish.
await new Promise(resolve => setTimeout(resolve, 1500));
const zs = held.session;
const clips = JSON.parse(fs.readFileSync(manifest, 'utf8'));
const out = fs.openSync(outFile, 'w');
for (const clip of clips) {
  const read = f => new Float32Array(fs.readFileSync(f).buffer.slice(0));
  const pieces = clip.parts
    ? clip.parts.map(p => read(p.audio))
    : [read(clip.audio)];
  const audio = new Float32Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    audio.set(p, at);
    at += p.length;
  }
  engine.reset();
  engine.setMode('tracking');
  engine.setExpected(null);
  engine.setStructural(false);
  engine.setHint(clip.hint ?? null);
  const settle = () => engine.correct('noop');
  await settle();
  let t = 0;
  let locked = false;
  let checking = false;
  if (clip.expected) {
    const {surah: es, ayah: ea} = clip.expected;
    engine.setMode('correction');
    engine.setExpected({
      surah: es,
      ayah: ea,
      ayahEnd:
        clip.expected.ayahEnd ??
        Math.max(ea, Math.min(surahLength(es), ea + PASSAGE_AYAT - 1)),
    });
    engine.setStructural(true);
    await settle();
    if (clip.expected.word) zs.engine.track(es, ea, clip.expected.word);
    checking = true;
  }
  let lastKey = null;
  let expectedEnd = clip.expected
    ? (clip.expected.ayahEnd ??
      Math.max(
        clip.expected.ayah,
        Math.min(
          surahLength(clip.expected.surah),
          clip.expected.ayah + PASSAGE_AYAT - 1,
        ),
      ))
    : 0;
  let expectedSurah = clip.expected?.surah ?? 0;
  const skippedKeys = new Set();
  const changes = [];
  const events = [];
  let book = marks.emptyMarkBook();
  const shown = new Map();
  const corrected = new Set();
  const added = [];
  const applyUpdate = (u, ms) => {
    book = u.book;
    for (const m of u.confirmed) {
      if (m.kind === 'added')
        added.push({
          left: m.word,
          id: `${m.surah}:${m.ayah}:${m.word}`,
          t: ms / 1000,
        });
      else if (!shown.has(`${m.surah}:${m.ayah}:${m.word}`))
        shown.set(`${m.surah}:${m.ayah}:${m.word}`, {
          since: m.since / 1000,
          shownAt: ms / 1000,
          kind: m.kind,
          junction: !!m.junction,
        });
    }
    for (const m of u.corrected ?? [])
      corrected.add(`${m.surah}:${m.ayah}:${m.word}`);
  };
  const runDue = limit => {
    for (
      let due = marks.nextConfirmAt(book);
      due !== null && due <= limit;
      due = marks.nextConfirmAt(book)
    ) {
      applyUpdate(marks.confirmDue(book, due), due);
    }
  };
  listener = msg => {
    const ms = t * 1000;
    if (msg.type === 'word_verdicts') {
      runDue(ms);
      for (const c of msg.changes)
        changes.push({
          t: +t.toFixed(2),
          id: `${c.surah}:${c.ayah}:${c.word}`,
          to: c.state,
          repeat: !!c.repeat,
          junction: c.detail?.junctionMissing ?? null,
          added: c.addedBefore ?? null,
        });
      if (locked) {
        const kept = marks.dropRealignment(
          marks.dropLockArtifacts(msg.changes, msg.lock ?? null),
        );
        applyUpdate(marks.applyVerdicts(book, kept, ms, msg.audioTime), ms);
      }
      return;
    }
    if (msg.type === 'word_progress') {
      locked = true;
      lastKey = `${msg.surah}:${msg.ayah}`;
      events.push(['wp', +t.toFixed(2), lastKey]);
      if (!checking) {
        expectedSurah = msg.surah;
        expectedEnd = Math.max(
          msg.ayah,
          Math.min(surahLength(msg.surah), msg.ayah + PASSAGE_AYAT - 1),
        );
        engine.setMode('correction');
        engine.setExpected({
          surah: msg.surah,
          ayah: msg.ayah,
          ayahEnd: expectedEnd,
        });
        engine.setStructural(true);
        checking = true;
      }
    } else if (
      msg.type === 'correction' &&
      msg.state?.phase === 'error' &&
      msg.state.issue?.kind === 'possible_skipped_ayah'
    ) {
      skippedKeys.add(`${msg.state.issue.surah}:${msg.state.issue.ayah}`);
    } else if (msg.type === 'verse_match' && checking) {
      if (skippedKeys.has(`${msg.surah}:${msg.ayah}`)) return;
      if (
        msg.surah === expectedSurah &&
        expectedEnd < surahLength(msg.surah) &&
        msg.ayah > expectedEnd - SLIDE_WITHIN
      ) {
        const from = Math.max(1, msg.ayah - 1);
        expectedEnd = Math.max(
          from,
          Math.min(surahLength(msg.surah), from + PASSAGE_AYAT - 1),
        );
        engine.setExpected({
          surah: msg.surah,
          ayah: from,
          ayahEnd: expectedEnd,
        });
      }
    } else if (msg.type === 'debug') {
      if (LOCK.has(msg.event)) locked = true;
      if (UNLOCK.has(msg.event)) {
        locked = false;
        book = marks.dropSuspects(book);
      }
      if (FALLBACK.has(msg.event) && checking) {
        engine.setMode('tracking');
        engine.setExpected(null);
        engine.setStructural(false);
        if (lastKey) {
          const [s, a] = lastKey.split(':').map(Number);
          engine.setHint({surah: s, ayah: a});
        }
        checking = false;
      }
    }
  };
  for (let off = 0; off < audio.length; off += CHUNK) {
    const chunk = audio.slice(off, Math.min(off + CHUNK, audio.length));
    t = (off + chunk.length) / SR;
    engine.feed(chunk);
    await settle();
  }
  runDue(Infinity);
  await engine.stop();
  listener = () => undefined;
  const skipped = skippedKeys;
  const visible = [...shown.entries()].filter(([id]) => {
    const [s, a, w] = id.split(':').map(Number);
    return (
      !skipped.has(`${s}:${a}`) && !(w < 3 && skipped.has(`${s}:${a - 1}`))
    );
  });
  fs.writeSync(
    out,
    JSON.stringify({id: clip.id, seconds: t, changes, visible, added}) + '\n',
  );
}
fs.closeSync(out);
await engine.dispose();
console.log('done', clips.length);
