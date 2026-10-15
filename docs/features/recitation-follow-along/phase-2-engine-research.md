# Phase 2 research: Tilawa engine internals

Date: 2026-10-15. Paths relative to `node_modules/@tilawa/core/dist/`.
Benchmarks: Node normal and `--jitless` on the real corpus; jitless fbank
(107 ms per audio second) matches the device split (~60% of 208 ms JS per audio
second on the iPhone 14 Pro).

## 1. State signalling

Public events (`types.d.ts:77-98`): `verse_candidate` only on lock
(`recitation/session.js:753-770`), `word_progress` on each cursor/verdicts
event (`:730-741`), `verse_match` once per ayah when it clears the gate
(`:873-884`), `raw_transcript` every chunk with tokens (whole transcript),
`final_sequence` at `stop()`.

Internal engine events (`located`, `relocated`, `lost`, `locateFailed`, `idle`
silent/lost, `completed`) reach the app only as `{type: 'debug', event}` with
`debug: true` (`session.js:788-795`). `session.engineState` is `searching` or
`tracking` (`:251-253`); it returns to searching after 8 s with no progress,
~4.4 s of struggling, or end of surah.

Plan: pass `debug: true`, switch on `debug.event` for located / relocated /
lost / locateFailed / idle / completed, and treat `engineState` after each
feed as the source of truth.

First lock (`recitation/engine.js:197-233`, `search.js`): search once 12 chars
are buffered, then every 12 chars or 1 s; decisive at distance <= 0.35, margin
>= 0.1, >= 20 aligned chars (constant). Isti'adha and basmala are stripped and
delay the search by about their own length. The hint promotes near-ties within
0.1 and stops counting them as rivals. Expect ~2.5 to 3.5 s from speech onset,
plus 2 to 4 s with an isti'adha or basmala.

## 2. word_progress and recited ayat

- `word_index` is the frontier word (most recently heard letters), possibly
  partly recited (`tracker.js:178-192`).
- `matched_indices` are `ok`/`unsure` verdicts in the cursor's ayah, volatile.
- `verse_match` fires at about half the ayah's words
  (`emission.js:11-14`, `minWordFraction` 0.5), not at its end.
- A skipped interior ayah gets `skipped` verdicts and no `verse_match`.
- Cross-surah relocate needs ~3 s of disagreement (`engine.js:278-307`).
- For a recited tint: collect `verse_match` events (incremental, deduped).
  `session.verses` misses the current lock. For "fully recited", derive from
  `matched_indices` covering `total_words` or raise `minWordFraction`.

## 3. Where feed() time goes

Chain: fbank, ORT, greedy CTC, engine, emission (`session.js:497-590`).

1. Fbank (`recitation/fbank.js`): 100 frames/s, 512-point complex FFT in
   Float64 with twiddles rebuilt per frame, 80 mel bins, a new Float32Array per
   frame. ~107 ms per audio second jitless (~125 ms on the 14 Pro), constant
   over a session. Native (vDSP / KissFFT) would be under 2 ms.
2. `VerdictTracer.verdicts()`: judges every word of the current lock with two
   DP alignments each, called up to 5 times per chunk in tracking mode
   (including for `correction.observe`, which returns immediately outside
   correction mode). `lastStates` cleanup is O(words^2)
   (`engine.js:479-482`). Grows with session length: Al-Mulk went from 8 ms to
   44 ms per chunk; single chunks over 100 ms.
3. `QuranIndex.search`: every 12 chars / 1 s while searching, every 37 frames
   while tracking (relocate check). Most of the 100 to 250 ms spikes.
4. `Tracker.feedOne`: O(surah phoneme length) per char with an allocation per
   char; 47% of tracking time on Al-Baqarah.

Also: unbounded `transcriptParts` rebuilt per event (O(n^2), only for hour-long
takes); ~3.3 MB of recurrent state copied per ORT run (~7 MB/s garbage).

Config: `enableFallback: false` (avoids a whole-Quran Levenshtein at stop);
`relocateEveryFrames` ~75 optional; `stayOnSurah: true` would disable relocate
but loses cross-surah following.

Patch (small): memoize `verdicts()` per (tracker revision, heard length,
settled), guard the `observe` call with `correction.mode === 'correction'`,
Set-based `lastStates` cleanup. Expected ~60% less verdict cost and no
quadratic term.

## 4. Off the JS thread

- `react-native-worklets` 0.8.3 has `createWorkletRuntime`, but bundle mode is
  not enabled, so Tilawa's classes cannot run in a worker runtime.
- onnxruntime-react-native is JSI: `global.OrtApi` exists only on the main
  runtime; inference runs on its own thread and resolves on the JS thread;
  inputs are zero-copy from the ArrayBuffer base (ignores `byteOffset`, never
  pass `subarray` views); outputs are memcpy'd. ORT cannot run in a worker
  runtime.

Recommendation:
1. Now (~0.5 day): `enableFallback: false`, `debug: true` state events, the
   verdict patch.
2. Native fbank (2 to 4 days, biggest single win): local Expo module, C++ core
   (kaldi-native-fbank, Apache-2.0, matches `torchaudio.compliance.kaldi.fbank`)
   or vDSP; streaming `acceptWaveform` / `inputFinished` / `reset` with the same
   framing (`fbank.js:102-137`), writing into a preallocated Float32Array.
   Validate against JS `KaldiFbank` and upstream
   `lab/docs/specs/vectors/fbank_001002.json` (max abs log-mel diff < 1e-3) and
   identical tokens on recorded fixtures. JS per audio second ~0.21 to ~0.09 on
   the 14 Pro, RTF ~0.25 to ~0.13.
3. Worker runtime: not now (1 to 2 weeks, high risk).
4. Later for long surahs: `Tracker.feedOne` in C++.

## 5. Memory

ORT resident ~100 to 150 MB (unmeasured); JS heap retains ~14.5 MB
(corpus + index) plus ~1.5 MB posteriors. Load blocks the JS thread ~1 to 2 s
on Hermes. Policy: keep loaded while the mushaf is mounted; dispose on leaving
the mushaf, after ~3 to 5 minutes idle, on memory warning and on background.

## 6. Correction mode entry points

`setMode`, `correct`, `setExpected`, `setSlipHead`, `setStructural`,
`verdicts()`; events `correction` and `correction_note`. See
phase-3-research.md.
