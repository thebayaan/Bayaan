/* eslint-env node, es2020 */
// Every suite of the final read: which clips, in what modes, and where today's run of
// each clip lies. Unlike ../lib.mjs this reads all cells. A cell's label says whether
// the rule's tuning read it (see SCOREBOARD.md).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BENCH = path.resolve(HERE, '../../recitation-bench');
export const FINAL = path.join(BENCH, '.out/second-look/final');
const MAN = path.join(BENCH, '.out/natural/manifests');
const V = path.join(BENCH, '.out/natural/verify');
const J = path.join(BENCH, '.out/natural/junction');
const BASE = path.join(BENCH, '.out/natural/baseline/runs');
const CHATTER = path.join(BENCH, '.out/chatter/runs');
export const TODAY_RUNS = path.join(FINAL, 'today_runs');

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export const fileOf = id => `${String(id).replace(/[^\w.-]/g, '_')}.json`;

export const TUNING_VOICES = [
  'none_0',
  'one_en_10',
  'one_ar_10',
  'crowd_10',
  'tv_ar_10',
  'rec_one_10',
  'one_en_5',
  'one_ar_5',
  'crowd_5',
  'tv_ar_5',
  'rec_one_5',
  'rec_same_5',
];
export const HELD_OUT_VOICES = [
  'none_0',
  'one_ar_10',
  'crowd_10',
  'one_ar_5',
  'crowd_5',
  'rec_one_5',
];
export const HELD_OUT_TODAY = path.join(CHATTER, 'final_test_today');
export const HELD_OUT_APP = path.join(CHATTER, 'final_test_app');

// The harness keeps the place on added-word events, as natural/added/go.sh does: the
// reader goes on with other words after the event, and one who carried on would not.
const KEEP_PLACE = {
  stayOnSurah: true,
  config: {idleFrames: 100000, lostRate: 9},
};

const fromManifest =
  (file, keep = () => true) =>
  () =>
    readJson(file).filter(keep);
const fromRuns = dir => () =>
  fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => readJson(path.join(dir, f)).clip);
const testCell = c =>
  c.truth?.reciterSplit === 'test' && c.truth?.pairSplit === 'test';

/**
 * clips: the clips, each as the bench takes it. modes: what playback plays. extra: options
 * the suite's harness adds to the app's. today: today's run of a clip, or null when none
 * is read. todayFrom: a manifest for today's engine when no saved run fits.
 */
export const SUITES = {
  pool: {
    clips: fromManifest(path.join(MAN, 'pool.json')),
    today: id => path.join(BASE, 'pool', fileOf(id)),
  },
  w1: {
    clips: fromManifest(path.join(MAN, 'w1.json')),
    modes: ['app', 'carry'],
    flush: true,
    today: id => path.join(BASE, 'w1', fileOf(id)),
  },
  w1_control: {
    clips: fromManifest(path.join(MAN, 'w1_control.json')),
    modes: ['app', 'carry'],
    flush: true,
    today: id => path.join(BASE, 'w1_control', fileOf(id)),
  },
  w5: {
    clips: fromManifest(path.join(MAN, 'w5.json')),
    today: id => path.join(BASE, 'w5', fileOf(id)),
  },
  learners: {
    clips: fromManifest(path.join(MAN, 'learners.json')),
    today: id => path.join(BASE, 'learners', fileOf(id)),
  },
  sobolev_multi: {
    clips: fromManifest(path.join(V, 'live/sobolev_multi.json')),
    todayFrom: path.join(V, 'live/sobolev_multi.json'),
  },
  quranmb: {
    clips: fromManifest(path.join(BENCH, '.out/takes/quranmb/manifest.json')),
    today: id => path.join(BENCH, '.out/real3/quranmb', fileOf(id)),
  },
  live_last: {
    clips: fromManifest(path.join(V, 'live/live.json')),
    todayFrom: path.join(V, 'live/live.json'),
  },
  live_control: {
    clips: fromManifest(path.join(V, 'live/control.json')),
    todayFrom: path.join(V, 'live/control.json'),
  },
  interior: {
    clips: fromManifest(path.join(V, 'live/interior.json')),
    todayFrom: path.join(V, 'live/interior.json'),
  },
  sites: {
    clips: fromManifest(path.join(J, 'manifests/junction_live.json')),
    todayFrom: path.join(J, 'manifests/junction_live.json'),
    dropLost: true,
  },
  sites_control: {
    clips: fromManifest(path.join(J, 'manifests/junction_control.json')),
    todayFrom: path.join(J, 'manifests/junction_control.json'),
    dropLost: true,
  },
  added_kept: {
    clips: fromManifest(path.join(V, 'live/added_test.json')),
    extra: KEEP_PLACE,
    todayFrom: path.join(V, 'live/added_test.json'),
    todayOpts: KEEP_PLACE,
  },
  added_app: {
    clips: fromManifest(
      path.join(BENCH, '.out/added/manifests/added_app_devtest.json'),
      testCell,
    ),
    todayFrom: path.join(BENCH, '.out/added/manifests/added_app_devtest.json'),
    todayKeep: testCell,
  },
};
for (const c of TUNING_VOICES) {
  SUITES[`voices_${c}`] = {
    clips: fromRuns(path.join(CHATTER, 'shipped', c)),
    today: id => path.join(CHATTER, 'shipped', c, fileOf(id)),
  };
}
for (const c of HELD_OUT_VOICES) {
  SUITES[`heldout_${c}`] = {
    clips: fromRuns(path.join(HELD_OUT_TODAY, c)),
    today: id => path.join(HELD_OUT_TODAY, c, fileOf(id)),
    heldOut: true,
  };
}

/** A cell, by reciter's split and the passage's or pair's. */
export function cellOf(truth) {
  const unit = truth?.pairSplit ?? truth?.blockSplit;
  if (!truth?.reciterSplit || !unit) return truth?.reciterSplit ?? 'none';
  return truth.reciterSplit === unit ? truth.reciterSplit : 'mixed';
}
