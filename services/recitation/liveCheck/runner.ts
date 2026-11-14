import {SURAHS} from '@/data/surahData';
import {trace} from '../debugTake';
import type {RecitationEngine} from '../recitationEngine';
import {ayahLetters} from '../secondLook/ayahLetters';
import {
  holdSecondLookModel,
  secondLookBusy,
  secondLookModel,
} from '../secondLook/checkWord';
import {corruptRow} from '../secondLook/corruptOutput';
import {NUM_BINS} from '../secondLook/fbank';
import type {SecondLookModel} from '../secondLook/model';
import type {EngineWord} from '../wordMarks';
import {isBlindSpot} from './blindSpots';
import {createLiveCheck} from './check';
import {LIVE_RUNS_PER_TICK, LIVE_TICK_SECONDS} from './config';
import type {
  LiveCheck,
  LiveDeps,
  LiveOpinion,
  LivePlace,
  LivePlan,
} from './types';

// One take's live check: after a chunk has been heard it asks the check what to read,
// reads those log-mel frames from the engine, runs the second look's model on them,
// and hands the check's opinions to the take, for up to three windows a tick. Output
// a broken onnxruntime build has spoiled never reaches the check. It never waits in the engine's queue,
// never queues a run behind another, and gives way to the second look, the follower's
// backlog and anything that fails: a tick it cannot run is skipped, and the next
// chunk tries again.

/** What the live check is made of, so tests can bring their own. */
export interface LiveCheckPort {
  create: (deps: LiveDeps) => LiveCheck;
  /** The loaded model, or null. Loads nothing. */
  model: () => SecondLookModel | null;
  /** The second look is using the model, or about to. */
  modelBusy: () => boolean;
  /** One model run at a time: the second look waits for this one. */
  holdModel: (run: Promise<unknown>) => void;
}

export const defaultLivePort: LiveCheckPort = {
  create: createLiveCheck,
  model: secondLookModel,
  modelBusy: secondLookBusy,
  holdModel: holdSecondLookModel,
};

/** What the live check needs from the take it runs in. */
export interface LiveHost {
  engine: () => RecitationEngine | null;
  /** The take is listening, locked and checking. */
  ready: () => boolean;
  /** One run's opinions. Must not throw. */
  report: (opinions: readonly LiveOpinion[]) => void;
}

export interface LiveRunner {
  setPlace: (place: LivePlace) => void;
  relocated: (place: EngineWord, audioTime: number) => void;
  lost: () => void;
  /** The take is over: a run still out reports nothing. */
  stop: () => void;
}

const SAMPLE_RATE = 16000;
// A log-mel frame every 160 samples, each 400 long, starting 120 before its own
// 160 (the engine's fbank): frame f is there once 160 f + 280 samples are.
const MEL_SHIFT = 160;
const MEL_REACH = 280;

/** Log-mel frames the engine holds after this much audio. */
export function melFramesHeard(audioTime: number): number {
  const samples = Math.round(audioTime * SAMPLE_RATE);
  return samples < MEL_REACH
    ? 0
    : Math.floor((samples - MEL_REACH) / MEL_SHIFT) + 1;
}

/**
 * The mean of each log-mel frame's bins: how loud each frame is, for the check.
 * @param data - [frames, 80] row by row
 */
export function melFrameMeans(
  data: Float32Array,
  frames: number,
): Float32Array {
  const means = new Float32Array(frames);
  let i = 0;
  for (let f = 0; f < frames; f += 1) {
    let sum = 0;
    for (let b = 0; b < NUM_BINS; b += 1) {
      sum += data[i];
      i += 1;
    }
    means[f] = sum / NUM_BINS;
  }
  return means;
}

export const liveDeps: LiveDeps = {
  letters: ayahLetters,
  ayahCount: surah => SURAHS[surah - 1]?.verses_count ?? 0,
  blind: isBlindSpot,
};

const nextTask = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface Skips {
  inFlight: number;
  notReady: number;
  backlog: number;
  secondLook: number;
  noModel: number;
  shortRead: number;
  failed: number;
  corrupted: number;
}

/** Starts the live check for a take. Never throws: with no check, nothing runs. */
export function startLiveCheck(
  host: LiveHost,
  port: LiveCheckPort,
  deps: LiveDeps = liveDeps,
): LiveRunner {
  let check: LiveCheck | null = null;
  try {
    check = port.create(deps);
  } catch (error) {
    trace(`live check: could not start (${messageOf(error)})`);
  }
  const engine = host.engine();
  let stopped = false;
  let running = false;
  let scheduled = false;
  let lastRunAt = -Infinity;
  let runs = 0;
  let opinionsSeen = 0;
  const modelMs: number[] = [];
  const skips: Skips = {
    inFlight: 0,
    notReady: 0,
    backlog: 0,
    secondLook: 0,
    noModel: 0,
    shortRead: 0,
    failed: 0,
    corrupted: 0,
  };

  const tell = (what: string, call: (c: LiveCheck) => void) => {
    if (!check || stopped) return;
    try {
      call(check);
    } catch (error) {
      trace(`live check: ${what} failed (${messageOf(error)})`);
    }
  };

  /** Why this run may not start now, counted, or the model to run it on. */
  function mayRun(): SecondLookModel | null {
    if (!host.ready()) {
      skips.notReady += 1;
      return null;
    }
    if ((engine?.getStats().backlog ?? 0) > 0) {
      skips.backlog += 1;
      return null;
    }
    if (port.modelBusy()) {
      skips.secondLook += 1;
      return null;
    }
    const model = port.model();
    if (!model) skips.noModel += 1;
    return model;
  }

  /** One window: its opinions, or null when the run was dropped. */
  async function run(
    current: LiveCheck,
    model: SecondLookModel,
    plan: LivePlan,
    data: Float32Array,
    frames: number,
  ): Promise<LiveOpinion[] | null> {
    const energy = melFrameMeans(data, frames);
    const startedAt = Date.now();
    const modelRun = model.run(data, frames);
    port.holdModel(modelRun);
    const output = await modelRun;
    const ms = Date.now() - startedAt;
    modelMs.push(ms);
    runs += 1;
    if (stopped) return null;
    const row = corruptRow(output.logp, output.frames);
    if (row >= 0) {
      skips.corrupted += 1;
      if (skips.corrupted === 1) {
        trace(
          `live check: corrupted model output, run dropped (run ${plan.from}-${plan.to}, row ${row})`,
        );
      }
      return null;
    }
    // The check's own work comes in a task of its own, not on the end of the model's.
    await nextTask();
    if (stopped) return null;
    const opinions = current.step(plan, output.logp, output.frames, energy);
    const finals = opinions.filter(o => o.final).length;
    opinionsSeen += opinions.length;
    trace(
      `live run ${plan.from}-${plan.to}: ${opinions.length} opinions (${finals} final), model ${ms} ms`,
    );
    return opinions;
  }

  // Up to three windows, each asked for after the last one's step and each through
  // the same gates as the first: whatever stops one stops the tick. The tick's
  // opinions go to the take together, so the marks of one tick show at once with one
  // vibration, as the second look's words of one chunk do.
  async function runTick(current: LiveCheck, audioTime: number): Promise<void> {
    const heard = melFramesHeard(audioTime);
    const opinions: LiveOpinion[] = [];
    for (let n = 0; n < LIVE_RUNS_PER_TICK && !stopped; n += 1) {
      if (n > 0) {
        await nextTask();
        if (stopped) break;
      }
      const model = mayRun();
      if (!model || !engine) break;
      const plan = current.plan(heard);
      if (!plan) break;
      const span = engine.readMelFrames(plan.from, plan.to);
      if (span.first !== plan.from || span.frames !== plan.to - plan.from) {
        skips.shortRead += 1;
        trace(
          `live run ${plan.from}-${plan.to}: skipped, read ${span.frames} frames from ${span.first}`,
        );
        break;
      }
      if (n === 0) lastRunAt = audioTime;
      let said: LiveOpinion[] | null;
      try {
        said = await run(current, model, plan, span.data, span.frames);
      } catch (error) {
        skips.failed += 1;
        trace(`live run ${plan.from}-${plan.to}: failed (${messageOf(error)})`);
        break;
      }
      if (!said) break;
      opinions.push(...said);
    }
    if (opinions.length === 0 || stopped) return;
    await nextTask();
    if (stopped) return;
    host.report(opinions);
  }

  function tick(audioTime: number): void {
    scheduled = false;
    const current = check;
    if (stopped || !current || !engine) return;
    if (running) {
      skips.inFlight += 1;
      return;
    }
    running = true;
    runTick(current, audioTime)
      .catch(error => {
        skips.failed += 1;
        trace(`live check: tick failed (${messageOf(error)})`);
      })
      .finally(() => {
        running = false;
      });
  }

  // In the engine's queue, at the end of each chunk: only a tick is scheduled here.
  const onChunk = (audioTime: number) => {
    if (stopped || scheduled) return;
    if (running) {
      skips.inFlight += 1;
      return;
    }
    if (audioTime - lastRunAt < LIVE_TICK_SECONDS) return;
    scheduled = true;
    setTimeout(() => {
      tick(audioTime);
    }, 0);
  };
  if (check) engine?.setChunkListener(onChunk);

  return {
    setPlace: place => tell('setPlace', c => c.setPlace(place)),
    relocated: (place, audioTime) =>
      tell('relocated', c => c.relocated(place, audioTime)),
    lost: () => tell('lost', c => c.lost()),
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (check) engine?.setChunkListener(null);
      const sorted = [...modelMs].sort((a, b) => a - b);
      const median = sorted.length
        ? sorted[Math.floor(sorted.length / 2)]
        : '-';
      const max = sorted.length ? sorted[sorted.length - 1] : '-';
      trace(
        `live check this take: ${runs} runs, ${opinionsSeen} opinions, model median ${median} max ${max} ms; skipped ${skips.inFlight} in flight, ${skips.notReady} not ready, ${skips.backlog} backlog, ${skips.secondLook} second look, ${skips.noModel} no model, ${skips.shortRead} short read, ${skips.failed} failed, ${skips.corrupted} corrupted`,
      );
    },
  };
}
