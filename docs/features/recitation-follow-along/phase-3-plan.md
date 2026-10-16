# Phase 3 plan: memorisation (hifz) tools

Built from phase-3-research.md. Ground rule from the accuracy evidence: no
pronunciation, harakat or tajweed claims. Copy says "may have skipped", never
"mistake".

| # | Work | Status |
|---|---|---|
| 1 | Hide and reveal: eye toggle in the bar while reciting (persisted); unrecited words drawn as faint ghosts through SkiaLine's per-character colours (same glyphs, layout and ayah markers unchanged); words revealed up to the frontier word, the previous ayah completed when the next one starts; only the changed line rebuilds. SkiaPage and vertical mushaf. | done |
| 2 | Peek: tap a ghosted word (or a bar control) to reveal the next word, then the rest of the ayah; peeked words tinted differently and counted. | |
| 3 | Skip prompts after the take: correction mode with `setExpected` = the passage on screen (split at surah boundaries), structural rules at `stop`, live issues auto-deferred with `review_later`, then a summary sheet ("may have skipped 36:7", "may have read the similar ayah 7:111") with Retry ayah and a remembered "I read it correctly". Leave out `possible_vowel` and `unclear_ayah`. | |
| 4 | Device validation of item 3: false flags per minute on clean recitation and the tracking cost of the auto-defer decoder reset. | |
| 5 | Later: per-ayah peek and skip history. | |
