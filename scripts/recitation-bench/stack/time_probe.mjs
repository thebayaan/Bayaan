/* eslint-env node, es2020 */
// How long the new engine parts take, on this machine, per second of audio: the junction
// check, the gap report, and the two reads the second judge would make.
const session = {
  junction: 0,
  gaps: 0,
  reads: 0,
  read8s: 0,
  audio: 0,
  frames: 0,
  juncMax: 0,
};
export function createProbe({zs}) {
  const j = zs.junction;
  const orig = j.apply.bind(j);
  j.apply = (...args) => {
    const t = performance.now();
    const out = orig(...args);
    const d = performance.now() - t;
    session.junction += d;
    session.juncMax = Math.max(session.juncMax, d);
    return out;
  };
  let patched = false;
  let now = 0;
  return {
    start() {
      return undefined;
    },
    setTime(t) {
      now = t;
    },
    afterChunk() {
      session.audio = Math.max(session.audio, now);
      const tracer = zs.engine.tracer;
      if (tracer && !patched) {
        patched = true;
        const proto = Object.getPrototypeOf(tracer);
        const orig2 = proto.attachGaps;
        proto.attachGaps = function (...args) {
          const t = performance.now();
          const out = orig2.apply(this, args);
          session.gaps += performance.now() - t;
          return out;
        };
      }
      const t = performance.now();
      const end = zs.melFrames.end;
      zs.readMelFrames(end - 800, end);
      session.read8s += performance.now() - t;
      session.reads += 1;
    },
    finish() {
      return {};
    },
    afterStop() {
      return {};
    },
  };
}
process.on('exit', () => {
  console.log(
    JSON.stringify({
      audioSecondsLastClip: session.audio,
      junctionMsTotal: +session.junction.toFixed(2),
      junctionWorstCallMs: +session.juncMax.toFixed(3),
      gapsMsTotal: +session.gaps.toFixed(2),
      reads: session.reads,
      read8sMeanMs: +(session.read8s / Math.max(1, session.reads)).toFixed(3),
    }),
  );
});
