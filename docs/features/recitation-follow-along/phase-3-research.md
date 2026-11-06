# Phase 3 research: hifz tools (hide and reveal, mistake feedback)

Date: 2026-10-15. Sources: `@tilawa/core` 0.4.0 dist, upstream
[lab/EXPERIMENTS.md](https://github.com/yazinsai/tilawa/blob/main/lab/EXPERIMENTS.md)
and [web/frontend/src/correction-view.ts](https://github.com/yazinsai/tilawa/blob/main/web/frontend/src/correction-view.ts)
(last upstream commit 2026-10-04), Tarteel support and feedback pages.

## Bottom line

Tilawa reliably catches structure: skipped words, skipped ayahs and drifting
into a look-alike ayah (mutashabihat), with very few false flags. It catches
almost nothing at letter, vowel or tajweed level for real learners. Correction
mode also stops listening while an issue is open. Ship hide and reveal (no
correction mode needed) plus skip prompts after the take. Never claim
pronunciation or tajweed feedback.

## 1. Correction mode API (`dist/recitation/`)

- `setMode('correction')` (`session.js:305`): turns on posterior and verdict
  scoring that tracking mode skips.
- `setExpected({surah, ayah, ayahEnd?})` (`session.js:295`): correction mode
  only, kept across `reset()`. Locks onto the passage's first word (past any
  isti'adha or basmala), searches only inside it, never relocates to another
  surah. One surah per passage, so a page crossing a surah boundary needs the
  passage updated at the boundary. Biggest accuracy lever.
- `correct(action)` (`session.js:325`): `retry | stop_retry | dismiss |
  review_later | continue | close`. Always resets the decoder. `retry` builds a
  practice engine pinned to the flagged ayah. Raises the next queued
  structural flag.
- `CorrectionController` (`correction.js`): phases `idle | error | retrying |
  corrected`. A candidate must hold 12 frames (0.48 s). `dismiss`,
  `review_later` and `close` suppress that word for the session.
- Word rules (`correction.js` ~70-100): both neighbours must be in the same
  ayah and clear, so the first and last word of an ayah can never be flagged.
  Kinds: omission, substitution (distance >= 0.6, margin >= 0.65), vowel,
  repetition (GOP, a note only). GOP flag rule off by default.
- Ayah checks: `checkAyahGap` (`session.js:893`, N+2 right after N gives
  `possible_skipped_ayah` or `unclear_ayah`) and `checkSkippedAyah`
  (`:831`, needs `setExpected`).
- Structural rules (text-only): `ayahOrder` (skipped ayah, no passage needed)
  and `similarVerse` (look-alike substitution needs `setExpected`, plus
  dropped word). Default `timing: 'stop'` runs once at `stop()` (~5 ms) and
  drains one flag per `correct()`. `timing: 'pause'` is unvalidated and noisier.
  We currently pass `structural: false` in `recitationEngine.ts`.
- Slip head (`setSlipHead`): 65 training positives, test-informed cutoff,
  opt-in upstream. Do not ship.

### Events and timing

| Event | When | Notes |
|---|---|---|
| `word_progress` | live | `matched_indices` = words in `ok`/`unsure` state. Not emitted while the practice engine runs. |
| `correction` (error) from word or ayah rules | live, median ~3 s after the slip | Once raised, `feed()` drops audio until `correct()` is called; `stop()` returns nothing unless idle. |
| `correction` from structural rules | at `stop()` | one per `correct()` call, `source: ayah_order / similar_verse` |
| `correction_note` | live | soft repetition note |
| `correction` retrying / corrected | live during retry | after `continue`, the next 1-2 s decode poorly |

Upstream demo is interrupt-and-retry (modal, mic dropped while open), hedged
copy ("Possible mistake", "may have been skipped"). To avoid interrupting,
record each issue and immediately `correct('review_later')` (costs a decoder
reset, ~1-2 s weaker tracking), then drain with `review_later` after `stop()`.

## 2. Accuracy

Acted test set, 207 in-scope labels, a0w, with passage:

| Kind | Caught | Notes |
|---|---|---|
| Skipped word | 35/56 | 33 without passage |
| Substitution | 28/46 | only look-alike-ayah swaps; ordinary substitutions on unseen words +1/18 |
| Skipped ayah | 26/36 | 21 without passage; synthetic held-out 103/120 |
| Vowel | 1/39 | |
| Repetition | 0 as its own kind | as a note 5/6 real |
| Tajweed | 0/27 | out of scope by design |

- Totals: 61/207 without passage, 91/207 with. Precision 0.94 to 0.99, exact word.
- Real learners: shipped defaults catch 0/42 letter/vowel words, 0/11 tajweed,
  4/502 RetaSy mistake clips. TLOG interior-word recall 5 to 7%; 811/1,519
  real slips are on first/last words and uncatchable by design.
- False flags: 0 to 0.06 per minute (about one per 15 to 30 minutes), mostly
  `possible_vowel` or `possible_skipped_ayah`. One live false skipped-ayah
  followed a dismiss reset, relevant to auto-defer.

## 3. Hide and reveal in the Skia renderer

Painting today: `SkiaLine` builds one paragraph per line plus a stroke
paragraph, pushing per-character styles for tajweed or custom colour
(`SkiaLine.tsx:172-201`); `charToColor` wins over tajweed and already drives the
Allah-name colour (`pageOverlays.ts:77-96`). Background rects come from
`getRectsForRange` (`SkiaLine.tsx:367-445`).

| Option | Verdict |
|---|---|
| A. Per-character transparent (or ghost alpha) colour through `charToColor`, merged last | Recommended. Exact glyphs incl. overhanging marks; one line paragraph rebuild per reveal (few ms, fit pass cached). |
| B. Clip mask to word rects | Rejected: Arabic marks overhang word rects. |
| C. Paint over with background colour | Rejected: breaks on themed backgrounds, same overhang issue. |

Notes: build the hidden map per line and keep unchanged lines' `Map` identity
so only the changed line rebuilds (today the Allah maps rebuild every line).
Faint placeholder bands can reuse `backgroundHighlights`. Ayah markers sit
outside `wordEnd`, so they stay visible unless we choose to hide them. Store a
cumulative revealed set per verse; map with `dkWordPosition`.

Driving it: reveal up to `word_index` (and all earlier ayahs) on each
`word_progress`; words below the cursor missing from `matched_indices` can get
a neutral "unsure" tint, never "wrong". Reveal lags 0.5 to 1.5 s and is never
early. The last word of an ayah may only appear when the next ayah starts or
after ~1 s of silence; settle on `stop()`. A skipped ayah simply stays hidden,
the most honest skip feedback available.

## 4. Competitors

Tarteel Premium (about $19.99/month, third-party listing) has live
memorisation mistake detection, hidden verses with peek (first word, then the
whole ayah), colours (red error, green correct, yellow tashkeel opt-in, brown
peeked), vibration on mistake, mistake history. Launched word-level only (no
harakat or tajweed). Pain points: false positives (the "not an error" request
had 99 votes), dismissals not sticking, red progress after removal, repeated
false flags on 37:36 (a look-alike Tilawa lists). Retain Quran (free, beta)
and Hifz AI (Android) offer hide-and-recite checks without tashkeel.

Copy: hide then reveal, escalating peek with its own tint, per-ayah history,
toggles, tashkeel feedback opt-in. Avoid: interrupting on every flag, red
styling for uncertain detections, dismissals that do not stick.

## 5. Recommended scope

Ship:
1. Hide and reveal toggle next to Recite: ghosted text (option A), cumulative
   reveal from `word_progress`, peek (next word, then next ayah) tinted and
   logged, no mistake claims. About 4 to 6 days.
2. Skip prompts after the take: correction mode with `setExpected` = the
   passage on screen, structural rules at `stop`, live issues auto-deferred,
   a summary sheet ("may have skipped", "may have read the similar ayah X:Y")
   with Retry ayah and a persisted "I read it correctly". Leave out
   `possible_vowel`/`unclear_ayah`. About 5 to 7 days plus 2 days of device
   validation of the auto-defer reset cost.

Avoid: live interrupting dialogs, `timing: 'pause'`, the slip head, the GOP
flag rule, any tajweed/harakat/pronunciation claim.

Copy allowed: "Hide the page and recite from memory. Words appear as you
recite. After your take, Bayaan points out ayahs or words you may have skipped
and similar verses you may have mixed up." Not allowed: "detects your
mistakes", "corrects your recitation".

Later: per-ayah mistake and peek history (MMKV, ~3 days); an opt-in
experimental mid-recitation skip prompt after on-device false-flag measurement.
