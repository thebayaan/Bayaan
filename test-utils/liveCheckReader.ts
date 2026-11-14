import {
  createLiveCheck,
  type LiveConfig,
  type LiveWatch,
} from '@/services/recitation/liveCheck/check';
import type {
  LiveCheck,
  LiveDeps,
  LivePlace,
  LivePlan,
  LiveVerdict,
} from '@/services/recitation/liveCheck/types';

// A made-up recitation laid out frame by frame, a fake model that reads it, and the
// app's tick loop around the live check, for the check's tests. Ported from the state
// machine review's harness, which lives only in the bench's untracked output, and
// trimmed. Words are made-up letter strings from the check's alphabet, never text of
// the Quran, and places are surah:ayah:word.

/** The check's alphabet, in letter-number order: letter k is ALPHABET[k - 1]. */
export const ALPHABET = 'ءابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const VOCAB = 31;
const SEP = 30;

/** Letters from their numbers (1 to 29). */
export const lettersOf = (...ids: number[]) =>
  ids.map(i => ALPHABET[i - 1]).join('');

/** Every letter moved one on: all letters differ, and it is no word of the text. */
export const shifted = (letters: string) =>
  [...letters]
    .map(c => ALPHABET[(ALPHABET.indexOf(c) + 1) % ALPHABET.length])
    .join('');

/**
 * A made-up word of n letters from a seeded generator, no letter twice in a row, so
 * that words of different ayat are unrelated unless a test makes them alike.
 */
export function madeUpWord(seed: number, n = 4): string {
  let x = (seed * 2654435761) % 4294967296;
  const rnd = () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
  for (let k = 0; k < 5; k++) rnd();
  const out: number[] = [];
  while (out.length < n) {
    const id = 1 + Math.floor(rnd() * 29);
    if (id !== out[out.length - 1]) out.push(id);
  }
  return lettersOf(...out);
}

/** A made-up ayah of n words of len and len + 1 letters in turn. */
export function madeUpAyah(a: number, n: number, len = 4, salt = 0): string[] {
  return Array.from({length: n}, (_, i) =>
    madeUpWord(a * 1000 + i * 17 + salt * 100000 + 3, len + (i % 2)),
  );
}

/** The app's letters for a few made-up surahs: surah number to its ayat. */
export function depsOf(
  surahs: Record<number, readonly (readonly string[] | null)[]>,
): LiveDeps {
  return {
    letters: (s, a) => surahs[s]?.[a - 1] ?? null,
    ayahCount: s => surahs[s]?.length ?? 0,
  };
}

interface Frame {
  /** The token the model writes here when it reads this utterance. */
  k: number;
  /** The utterance (one ayah's reading) it belongs to, -1 for none. */
  u: number;
  loud: boolean;
  /** The word being said, as surah:ayah:word. */
  key: string | null;
  /** For a word's first frame: its letters and the frame after it. */
  wordStart?: {letters: string; end: number};
}

/** Model frames of 40 ms, one after another. */
export class Timeline {
  readonly f: Frame[] = [];
  private u = 0;

  quiet(seconds: number): this {
    const n = Math.round(seconds / 0.04);
    for (let i = 0; i < n; i++)
      this.f.push({k: 0, u: -1, loud: false, key: null});
    return this;
  }

  /**
   * One utterance, which the model reads as one ayah: each item is a word's key and
   * the letters said, or a pause of so many seconds inside the utterance.
   */
  say(
    items: readonly ([string, string] | ['#pause', number])[],
    {letterFrames = 3, wordGap = 2} = {},
  ): this {
    const u = this.u++;
    items.forEach((item, wi) => {
      if (item[0] === '#pause') {
        const n = Math.round((item[1] as number) / 0.04);
        for (let i = 0; i < n; i++)
          this.f.push({k: 0, u, loud: false, key: null});
        return;
      }
      const [key, letters] = item as [string, string];
      let prev = -1;
      const start = this.f.length;
      for (const c of letters) {
        const id = ALPHABET.indexOf(c) + 1;
        if (id === prev) this.f.push({k: 0, u, loud: true, key});
        for (let q = 0; q < letterFrames; q++) {
          this.f.push({k: id, u, loud: true, key});
        }
        prev = id;
      }
      this.f.push({k: 0, u, loud: true, key});
      this.f[start].wordStart = {letters, end: this.f.length};
      if (wi < items.length - 1) {
        this.f.push({k: SEP, u, loud: true, key: null});
        for (let q = 0; q < wordGap; q++) {
          this.f.push({k: 0, u, loud: true, key: null});
        }
      }
    });
    return this;
  }

  /**
   * An ayah's words in one utterance. `only` keeps those words, `replace` says other
   * letters in a word's place.
   */
  sayAyah(
    surah: number,
    ayah: number,
    words: readonly string[],
    opts: {
      only?: readonly number[];
      replace?: Record<number, string>;
      letterFrames?: number;
    } = {},
  ): this {
    const items: [string, string][] = [];
    words.forEach((letters, i) => {
      if (opts.only && !opts.only.includes(i)) return;
      items.push([`${surah}:${ayah}:${i}`, opts.replace?.[i] ?? letters]);
    });
    return this.say(items, {letterFrames: opts.letterFrames});
  }

  /** The tick (48 log-mel frames) where this word's audio starts or ends. */
  startTick(key: string): number {
    const i = this.f.findIndex(fr => fr.key === key);
    return (i * 4) / 48;
  }

  endTick(key: string): number {
    let end = -1;
    this.f.forEach((fr, i) => {
      if (fr.key === key) end = i;
    });
    return ((end + 1) * 4) / 48;
  }
}

export interface ModelOptions {
  /** It reads the next utterance once the window holds this many seconds of it. */
  switchAfter?: number;
  /** Or once the next has this share of the first's sound. */
  switchShare?: number;
  /** It writes nothing but blank. */
  blank?: boolean;
  /** The said letter wins by this many nats over the written one, where they differ. */
  altBy?: number;
}

/**
 * The fake model over frames [f0, f1): it reads the first utterance in the window, or
 * a later one once there is enough of it, and writes blank everywhere else. A word
 * begun before the right edge is written whole at once, squeezed into the frames
 * left, as the real model does: it knows the text by heart.
 */
export function fakeModel(
  tl: Timeline,
  f0: number,
  f1: number,
  {switchAfter = 1.5, switchShare = 0, blank = false}: ModelOptions = {},
): Float32Array {
  const frames = f1 - f0;
  const logp = new Float32Array(frames * VOCAB).fill(-15);
  const set = (f: number, k: number) => {
    logp.fill(-15, f * VOCAB, f * VOCAB + VOCAB);
    logp[f * VOCAB + k] = -0.01;
  };
  for (let f = 0; f < frames; f++) set(f, 0);
  if (blank) return logp;
  const soundOf = new Map<number, number>();
  const order: number[] = [];
  for (let f = f0; f < f1; f++) {
    const {u, k} = tl.f[f];
    if (u < 0 || k === 0) continue;
    if (!soundOf.has(u)) order.push(u);
    soundOf.set(u, (soundOf.get(u) ?? 0) + 1);
  }
  if (order.length === 0) return logp;
  let chosen = order[0];
  for (const u of order.slice(1)) {
    const sound = soundOf.get(u) ?? 0;
    const enough = switchShare
      ? sound >= switchShare * (soundOf.get(chosen) ?? 0)
      : sound * 0.04 >= switchAfter;
    if (enough) chosen = u;
  }
  for (let f = 0; f < frames; f++) {
    const fr = tl.f[f0 + f];
    if (fr.u === chosen) set(f, fr.k);
  }
  let s = f1 - 1;
  while (s >= f0 && !tl.f[s].wordStart) s--;
  const begun = s >= f0 ? tl.f[s] : undefined;
  if (begun?.wordStart && begun.u === chosen && begun.wordStart.end > f1) {
    const ids = [...begun.wordStart.letters].map(c => ALPHABET.indexOf(c) + 1);
    const per = Math.max(1, Math.floor((f1 - s) / (ids.length * 2)));
    let f = s - f0;
    let prev = -1;
    for (const id of ids) {
      if (f >= frames) break;
      if (id === prev) set(f++, 0);
      for (let q = 0; q < per && f < frames; q++) set(f++, id);
      prev = id;
    }
    while (f < frames) set(f++, 0);
  }
  return logp;
}

export interface Seen {
  tick: number;
  /** surah:ayah:word#reading */
  id: string;
  key: string;
  reading: number;
  verdict: LiveVerdict;
  final: boolean;
}

export interface DriveOptions {
  /** The lock that starts the take, and when. */
  lockAt?: {surah: number; ayah: number; word: number};
  /** Things to do to the check before a tick's place and plans. */
  events?: Record<number, (check: LiveCheck) => void>;
  /** The follower's place at this frame; by default the word said last. */
  follower?: (frame: number, tick: number) => LivePlace | null;
  /** Ticks the app does not run at all (the model was busy). */
  skip?: (tick: number) => boolean;
  /** No energy given with the model's output. */
  noEnergy?: boolean;
  model?: ModelOptions;
  modelAt?: (tick: number, round: number) => ModelOptions;
  /** Every plan is stepped twice with the same output; the second must say nothing. */
  stepTwice?: boolean;
  /** Ticks whose plans are asked for and never stepped (every run failed). */
  planOnly?: (tick: number) => boolean;
  /** This run of the tick (0, 1 or 2) is asked for and fails, and the tick ends there, as in the app. */
  failRun?: (tick: number, round: number) => boolean;
  config?: Partial<LiveConfig>;
  /** The check's bench hooks: its probe lines and its trace. */
  watch?: LiveWatch;
  /** Quiet ticks run after the timeline's end. */
  tailSeconds?: number;
  /** Called after each tick with the milliseconds spent in plan() and step(). */
  onTick?: (tick: number, ms: number) => void;
}

export interface Take {
  seen: Seen[];
  /** Each reading's first final opinion. */
  finals: Map<string, {verdict: LiveVerdict; tick: number}>;
  /** What broke a rule the check promises, one line each. */
  broken: string[];
  ticks: number;
  /** Final verdict of some reading of this word, the newest reading's. */
  finalOf: (key: string) => {verdict: LiveVerdict; reading: number} | null;
  /** Every reading of a word with a bad opinion, final or not. */
  badKeys: () => string[];
}

/**
 * Runs the take the way the app does: a tick every 48 log-mel frames, the follower's
 * place, then up to three plans for the same `heard`, each stepped with the fake
 * model's output and the frames' energy. Checks the check's promises on every opinion.
 */
export function drive(
  tl: Timeline,
  deps: LiveDeps,
  opts: DriveOptions = {},
): Take {
  const lockAt = opts.lockAt ?? {surah: 1, ayah: 1, word: 0};
  const check = createLiveCheck(deps, opts.config ?? {}, opts.watch ?? {});
  tl.quiet(opts.tailSeconds ?? 3);
  const melTotal = tl.f.length * 4;
  const seen: Seen[] = [];
  const finals = new Map<string, {verdict: LiveVerdict; tick: number}>();
  const newestReading = new Map<string, number>();
  const ids = new Set<string>();
  /** Each word's first frame of audio. */
  const saidFrom = new Map<string, number>();
  tl.f.forEach((fr, f) => {
    if (fr.key && !saidFrom.has(fr.key)) saidFrom.set(fr.key, f);
  });
  const broken: string[] = [];
  const placeOf = (frame: number): LivePlace | null => {
    for (let f = frame; f >= 0; f--) {
      const key = tl.f[f].key;
      if (!key) continue;
      const [surah, ayah, word] = key.split(':').map(Number);
      const totalWords = deps.letters(surah, ayah)?.length ?? 1;
      return {surah, ayah, word, totalWords};
    }
    return null;
  };
  check.relocated(lockAt, 0);
  let last: LivePlace = {
    ...lockAt,
    totalWords: deps.letters(lockAt.surah, lockAt.ayah)?.length ?? 1,
  };
  let tick = 0;
  for (let heard = 48; heard <= melTotal; heard += 48, tick++) {
    const frame = heard / 4 - 1;
    opts.events?.[tick]?.(check);
    const place = opts.follower ? opts.follower(frame, tick) : placeOf(frame);
    if (place) last = place;
    check.setPlace(last);
    if (opts.skip?.(tick)) continue;
    // Time in the check itself, not in the fake model.
    let ms = 0;
    let t0 = performance.now();
    for (let round = 0; round < 3; round++) {
      const plan: LivePlan | null = check.plan(heard);
      ms += performance.now() - t0;
      if (!plan) break;
      if (plan.to > heard || plan.from < heard - 1000 || plan.from >= plan.to) {
        broken.push(`tick ${tick}: plan ${plan.from}-${plan.to} for ${heard}`);
      }
      const f0 = Math.floor(plan.from / 4);
      const f1 = Math.floor(plan.to / 4);
      const model = {...opts.model, ...opts.modelAt?.(tick, round)};
      const logp = fakeModel(tl, f0, f1, model);
      const energy = new Float32Array(plan.to - plan.from);
      for (let m = 0; m < energy.length; m++) {
        energy[m] = tl.f[Math.floor((plan.from + m) / 4)].loud ? -3 : -12;
      }
      const given = opts.noEnergy ? undefined : energy;
      if (opts.planOnly?.(tick)) {
        t0 = performance.now();
        continue;
      }
      // The app stops a tick's runs at the first one that fails.
      if (opts.failRun?.(tick, round)) break;
      t0 = performance.now();
      const opinions = check.step(plan, logp, f1 - f0, given);
      if (opts.stepTwice && check.step(plan, logp, f1 - f0, given).length > 0) {
        broken.push(`tick ${tick}: a plan stepped twice gave opinions twice`);
      }
      ms += performance.now() - t0;
      for (const o of opinions) {
        const key = `${o.surah}:${o.ayah}:${o.word}`;
        const reading = o.evidence.reading;
        const id = `${key}#${reading}`;
        seen.push({tick, id, key, reading, verdict: o.verdict, final: o.final});
        if (o.verdict === 'fine' && !o.final) {
          broken.push(`tick ${tick}: ${id} fine but not final`);
        }
        if (o.verdict === 'fine' && (saidFrom.get(key) ?? Infinity) > frame) {
          broken.push(`tick ${tick}: ${id} fine before it was said`);
        }
        const before = finals.get(id);
        if (before && (!o.final || o.verdict !== before.verdict)) {
          broken.push(
            `tick ${tick}: ${id} was final ${before.verdict}, now ${
              o.final ? 'final' : 'not final'
            } ${o.verdict}`,
          );
        } else if (!before && o.final) {
          finals.set(id, {verdict: o.verdict, tick});
        }
        // A reading number never goes back: a new reading of a word is never
        // numbered below one already given for it.
        const newest = newestReading.get(key) ?? -1;
        if (!ids.has(id) && reading < newest) {
          broken.push(`tick ${tick}: ${id} is new after reading ${newest}`);
        }
        ids.add(id);
        if (reading > newest) newestReading.set(key, reading);
      }
    }
    opts.onTick?.(tick, ms);
  }
  return {
    seen,
    finals,
    broken,
    ticks: tick,
    finalOf: key => {
      let best: {verdict: LiveVerdict; reading: number} | null = null;
      for (const [id, v] of finals) {
        const [k, r] = id.split('#');
        if (k !== key) continue;
        const reading = Number(r);
        if (!best || reading > best.reading)
          best = {verdict: v.verdict, reading};
      }
      return best;
    },
    badKeys: () => [
      ...new Set(
        seen
          .filter(s => s.verdict !== 'fine')
          .map(s => `${s.id} ${s.verdict}${s.final ? '' : '?'}`),
      ),
    ],
  };
}

/** Every place of these ayat, surah:ayah:word. */
export const keysOf = (surah: number, ayah: number, words: number) =>
  Array.from({length: words}, (_, i) => `${surah}:${ayah}:${i}`);
