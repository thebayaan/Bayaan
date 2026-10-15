# Phase 4 research: other platforms

Date: 2026-10-15.

## Findings that change earlier assumptions

1. QCF does not follow recitation: `QCFPage.tsx:61,159` reads
   `usePlaybackVerseKeys()`, which is empty once follow-along stops the mushaf
   player. Only SkiaPage and ContinuousMushafView use `usePlaybackBand()`.
2. Reading views (ReadingPageView, ContinuousListView) gate the Hafs active
   row and auto-scroll on the mushaf player playing
   (`ReadingPageView.tsx:156-157,229,311-316`; `ContinuousListView.tsx:210-211,437-442`).
3. Web is the separate Next.js app `thebayaan/bayaan-web` (app.thebayaan.com),
   not Expo web. This repo has no web build. bayaan-web sends
   `Permissions-Policy: microphone=()` (`next.config.ts:11-14`), which blocks
   the mic.
4. No rewayah gate: on a non-Hafs page Tilawa's Hafs keys and word indices land
   on the wrong words. Gate to Hafs text or map through verse units.

## QCF word highlight (1 to 1.5 days)

QCFPage draws one Skia paragraph per line in the page's QCF v2 font; words come
from `data/mushaf/qcf/qcf-pages.json` with `{c, l: "s:a:w", t, f}` per word
(`QCFDataService.ts:6-11,64`). `buildQCFLineRenderModel` (`QCFLineService.ts:30`)
already builds `charMeta[]` with `{verseKey, location, wordIndex}` per char
(hair space at index 1 has null meta). Highlights are `{start,end,color}` ranges
painted with `getRectsForRange` (`QCFPage.tsx:277-340, 824-840`).

Segmentation (measured): QCF 77,432 words plus 6,236 markers; DK identical per
verse and position; Tilawa 77,433, differing only at 37:130 where Tilawa splits
`إِلْ | يَاسِينَ` (QF/DK one word). Proportional fallback maps Tilawa 0..3 to
1,1,2,3; correct is 1,2,3,3. Use an override table
`{'37:130': [1, 2, 3, 3]}` shared by DK and QCF. Then find the line whose
`charMeta.location === "s:a:pos"` and push one range.

## Other renderers

| Renderer | Band | Word highlight |
|---|---|---|
| dk_v1 / dk_v2 / dk_indopak (SkiaPage) | works | works (device check IndoPak) |
| ContinuousMushafView | works | 0.5 day: shared hook from SkiaPage memo |
| ReadingPageView / ContinuousListView | broken for Hafs | 1 to 1.5 days: fix gating, `SkiaVerseText` already maps DK word ranges to rects (`SkiaVerseText.tsx:255-300`), add `recitedWordPosition`, `extraData` |

## Web (bayaan-web, 4 to 6 days)

Upstream web setup: onnxruntime-web/wasm single thread, SIMD, in a module
worker with one promise queue; pthreads can hang even with COOP/COEP, so
single-thread is what ships. Mic via getUserMedia plus an AudioWorklet that
resamples with continuous phase (resetting phase per block stretched tempo
0.78% and flipped vowels), 300 ms chunks. Model cached in IndexedDB with
streamed progress. Sizes: model 66 MB, corpus 5.5 MB, ORT wasm 12.4 MB.

COOP/COEP not worth it: `require-corp` would block QCF fonts, word audio and
CDN media; `credentialless` is not in Safari. Architecture: `engine.worker.ts`
(createZipformerSession with `structural: false`), `model-cache.ts` (IndexedDB,
`navigator.storage.persist()` against Safari's 7-day eviction),
`public/recitation/audio-processor.js` (port upstream, also catch
`createMediaStreamSource` rate failures on Firefox), a recitation store read by
`QuranWord` (`quran-word.tsx:61-64` already highlights a word by location).
Needs R2 with CORS, self-hosted ORT wasm, and `microphone=(self)`. Check
NPL-1.2 against shipping in AGPL bayaan-web.

## Android (1 to 2 days QA)

No other iOS-only code. Oboe opens input at the native rate and miniaudio
converts to 16 kHz (`AndroidAudioRecorder.cpp:71-77`,
`AndroidRecorderCallback.cpp:59-68,231-244`), so our JS resample is a no-op.
Watch input gain: the default `VoiceRecognition` preset disables AGC on many
devices (the Android twin of the iOS `measurement` problem); a patch to
`VoiceCommunication`/`Generic` may be needed. Check APK size and low-end
memory.

## TV: exclude

Apple TV apps cannot use the Siri Remote mic, and both native deps declare
only `:ios` in their podspecs. Android TV / Fire TV remote mics go to the
system assistant; Vega has no ONNX or audio-api port. The TV app is a separate
branch; gate with `Platform.isTV` if components are ever shared.
