# Justification Engine Deep Dive

This is the authoritative guide to `services/mushaf/JustificationService.ts`.

If something looks "off" in Digital Khatt, this file is usually the cause.

## Purpose

Given a line, the engine must make visual width match target line width while preserving Quranic calligraphic behavior.

It does this by:

1. measuring current line width,
2. applying small space adjustments,
3. applying char-level OpenType feature expansions in a strict order,
4. filling leftover width back into spaces,
5. or shrinking font when line is too long.

Output per line is `JustResultByLine`:

- `fontFeatures: Map<charIndex, SkTextFontFeatures[]>`
- `simpleSpacing: number`
- `ayaSpacing: number`
- `fontSizeRatio: number`

## Inputs and Coordinate Model

Constructor inputs:

- `pageNumber`, `lineIndex`
- `lineTextInfo` (tokenization + spaces from `QuranTextService`)
- `fontMgr` (Skia font provider)
- `fontSizeLineWidthRatio`
- `lineWidthRatio` (page/line-specific narrowing)
- optional shared paragraph builder

Internal constants:

- base line width model: `lineWidth = 2000`
- `desiredWidth = lineWidthRatio * lineWidth`
- `fontSize = fontSizeLineWidthRatio * lineWidth`
- `parInfiniteWidth = 1.5 * desiredWidth`

The math is ratio-based; absolute values are synthetic and used for stable shaping comparisons.

## `justifyLine()` Algorithm

### Step 1: baseline measurement

- measure each word independently (stored in `layoutResult`)
- measure full line width (`currentLineWidth`)
- compute `diff = desiredWidth - currentLineWidth`

### Step 2: branch by `diff`

#### If `diff > 0` (line too short)

1. tiny space stretch baseline:
   - `maxStretchBySpace = defaultSpaceWidth * 0.0001`
   - `maxStretchByAyaSpace = defaultSpaceWidth * 0.0001`
2. apply proportional stretch across space types
3. if still short -> run `stretchLine()` (feature lookups)
4. if still short after kashida:
   - distribute remaining width uniformly across spaces
   - compute `simpleSpacing` and `ayaSpacing`

#### If `diff <= 0` (line too long)

- no kashida logic
- shrink text:
  - `fontSizeRatio = desiredWidth / currentLineWidth`

## Why Spaces Stretch So Little

The configured max stretch multipliers (`* 0.0001`) are intentionally tiny, so expansion is mostly solved through glyph alternates and decomposition features, not plain inter-word spacing. This preserves Mushaf visual style.

## `stretchLine()` Overview

`stretchLine()` builds and updates `justInfo`:

- `textLineWidth`
- `desiredWidth`
- `layoutResult` (current per-word widths)
- `fontFeatures` (accepted features so far)

It defines lookup patterns and applies them in a strict sequence designed to mimic reference behavior.

## Feature and Lookup Concepts

Each lookup includes:

- `regExprs`: one or more regexes with named groups (`k1`, `k2`, etc.)
- optional `matchingCondition`
- optional `condition`
- `actions` per captured group

Action types:

- value action:
  - `{ name, value?, calcNewValue }`
- function action:
  - computes complex feature list based on context

Application model:

- proposed features are merged into a temporary map
- candidate word is re-shaped
- candidate is accepted only if:
  - width changed, and
  - new line width remains `< desiredWidth`

If candidate fails, engine reverts to previous accepted state.

## Core Lookups

### 1) `behBehLookup`

Pattern around linked beh-family letters.

Typical actions:

- `k1` -> `cv01` (+ optional `cv10` for selected letters)
- `k2` -> `cv02` with weighted increment

### 2) `finalAssensantLookup`

Uses multiple regex forms for ascendant endings.

Typical actions:

- `k3` -> `cv01` (+ optional `cv10`)
- `k4` -> `cv02`

Guarded by `matchingCondition()`.

### 3) `generalKashidaLookup`

General expansion fallback with extra regex branches (`k5` paths).

Includes critical guard:

- if matched `k5` character is in `finalIsolAlternates`
- and it is last base letter (`quranTextService.isLastBase`)
- then skip this lookup (`condition -> false`)

This avoids incorrect over-stretching of terminal forms.

### 4) `kafAltLookup`

Targets kaf context and sets `cv03`.

### 5) decomposition lookups via `applyDecomp`

Maps character pairs to decomposition features:

- `cv11`..`cv18`
- optionally also sets `cv01` / `cv02` levels

## Exact Application Order (Important)

Inside `stretchLine()`, lookups are applied in this order:

1. `behBehLookup` (2 levels)
2. alternates on `بتثكن` (2)
3. `finalAssensantLookup` (2)
4. `generalKashidaLookup` (1)
5. decomp set A (`cv16`, `cv11`, `cv12`, `cv13`, `cv14`, `cv15`, `cv17`, `cv18`, `cv16`)
6. alternates on `ىصضسشفقيئ` (2)
7. `kafAltLookup` (1)
8. `behBehLookup` (1)
9. alternates on `بتثكن` (1)
10. `finalAssensantLookup` (1)
11. `generalKashidaLookup` (1)
12. alternates on `ىصضسشفقيئ` (1)
13. `behBehLookup` (2)
14. alternates on `بتثكن` (2)
15. alternates on `ىصضسشفقيئ` (2)
16. `generalKashidaLookup` (2)

Do not reorder casually. Width fit and visual output are highly order-sensitive.

## `matchingCondition()` Behavior

This method blocks certain expansions to avoid invalid forms.

Rules include:

- reject short 2-base words except specific cases (`سش`)
- reject specific `lam` + (`kaf`/`dal`/`dhal`) combinations
- reject expansions that require prior `cv16` when unavailable
- reject combinations where terminal behavior would be invalid

This method is a visual correctness guard, not just a width strategy.

## Feature Merge Semantics

`mergeFeatures(prevFeatures, newFeatures)`:

- clones previous feature list
- merges by `feature.name`
- for existing features:
  - combine values via `calcNewValue` when provided
- for new features:
  - initialize using `calcNewValue(undefined, value)` when available

Result can be:

- updated array of font features
- `undefined` (effectively no feature for that char)

## Word Shaping Loop

`shapeWord(wordIndex, justResults)`:

- rebuilds paragraph for one word only
- applies per-char feature styles
- layouts paragraph
- returns shaped width (`getLongestLine()`)

`applyLookup()` uses this to validate every proposed feature update before accepting it into global line result.

## Page-Level API

### `getPageLayout(pageNumber, ratio, fontMgr)`

For each line:

- if centered line type (`surah_name`, or basmallah except pages 1/2):
  - returns neutral result (no features, default spacing, font ratio 1)
- otherwise:
  - builds `JustService` and calls `justifyLine()`

### `saveAllLayouts(...)`

- computes all 604 pages
- optional progress callback
- persists output via `saveLayoutToStorage()`

## Persistence and Serialization

Storage key:

- `dk_layout_${fontSizeLineWidthRatio}`

Because `fontFeatures` uses `Map`, custom JSON helpers are used:

- `replacer` serializes `Map` to `{dataType:'Map', value:[entries]}`
- `reviver` reconstructs `Map` during parse

Caches:

- persistent: AsyncStorage
- in-memory: static `cachedLayouts: Map<number, JustResultByLine[][]>`

## Safe Modification Rules

Before changing justification logic:

1. never reorder lookup stages unless you intentionally want output drift.
2. preserve guard methods (`matchingCondition`, final-form checks).
3. test pages with:
   - dense kashida candidates
   - short ending lines
   - pages 1, 2, 600, 602, 603, 604
4. clear cached layouts after logic changes (see debugging playbook).
5. compare before/after screenshots on same device dimensions.

## Practical "What Broke?" Guide

- line too tight / compressed:
  - check `fontSizeRatio` branch and overflow condition.
- line too loose:
  - check lookup acceptance conditions and desired width comparisons.
- terminal letters look wrong:
  - inspect `finalIsolAlternates` and `isLastBase` guard path.
- only some pages wrong:
  - inspect `lineWidthRatio` overrides and line type handling.
- stale output after code edits:
  - remove `dk_layout_*` keys from AsyncStorage and restart app.

