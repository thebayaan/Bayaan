# Phase 3 plan: memorisation (hifz) tools

Built from phase-3-research.md. Ground rule from the accuracy evidence: no
pronunciation, harakat or tajweed claims. Copy says "may have skipped", never
"mistake".

| # | Work | Status |
|---|---|---|
| 1 | Hide and reveal (revised after device test): unrecited words fully invisible (transparent, so layout and ayah markers stay); one revealed point that only moves forward, so starting mid-page shows everything before and a jump shows the skipped ayat; eye toggle in the bar while reciting (persisted). SkiaPage and vertical mushaf. | done |
| 2 | Peek: "Next word" and "Next ayah" buttons in the bar while hiding (tapping words is not practical); before any lock they start from the top of the page. | done |
| 2b | Page turn on the last word of the page instead of on the next page's first ayah; an ayah running over the page break does not send the reader back. | done |
| 3 | Skip prompts after the take: correction mode with `setExpected` = the passage on screen (split at surah boundaries), structural rules at `stop`, live issues auto-deferred with `review_later`, then a summary sheet ("may have skipped 36:7", "may have read the similar ayah 7:111") with Retry ayah and a remembered "I read it correctly". Leave out `possible_vowel` and `unclear_ayah`. | |
| 4 | Device validation of item 3: false flags per minute on clean recitation and the tracking cost of the auto-defer decoder reset. | |
| 5 | Later: per-ayah peek and skip history. | |
