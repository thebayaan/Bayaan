# RFC-028: Optional bundled adhkar and ambient audio

| Field  | Value                                                 |
| ------ | ----------------------------------------------------- |
| Status | Proposed (design only; a code PR follows acceptance)  |
| Date   | 2026-11-24                                            |
| Author | Omar Zarka (Qariah)                                   |

## Summary

Every build of the app bundles 51.4 MB of MP3: 425 adhkar recitations and 7 ambient loops. The files ship even when a build turns the adhkar or the ambient feature off, because Metro bundles each file that a static `require()` names. This RFC adds one build-time seam, `config/bundledAudio.config.js`, with two values, `adhkar` and `ambient`. When a value is `false`, `metro.config.js` resolves that pack's asset map to an empty map, so its MP3 files do not go into the JS bundle, the APK or the IPA. The default is `true` for both, so Bayaan's build does not change.

## Motivation

Measured on `develop` at `29f387a4c`:

| Pack | Files | Size | Where the `require()` calls are |
| --- | --- | --- | --- |
| Adhkar | 425 MP3 in `assets/audio/adhkar/` | 43,260,353 bytes (43.3 MB) | `utils/adhkarAudio.ts:18` (one entry for each file) |
| Ambient | 7 MP3 in `assets/audio/ambient/` | 8,142,270 bytes (8.1 MB) | `types/ambient.ts:42-72` (`AMBIENT_SOUNDS[*].source`) |

- `config/featureFlags.ts:13-14` already lets a fork turn `adhkar` and `ambientAudioOverlay` off. The flags hide the screens, but the asset maps stay in the module graph, so Metro still bundles all 432 files. A fork with both flags off ships 51.4 MB that no screen can play.
- MP3 does not compress further in an APK or an IPA, so the full 51.4 MB is in each download and each store update.
- A fork cannot remove the files itself without a conflict: `utils/adhkarAudio.ts` is a 484-line upstream file that changes when the adhkar content changes (for example `b25dbd723`), and a missing `require()` target breaks the build.
- The app already handles a dhikr with no audio: `services/adhkar/playback/sessionReducer.ts:31` marks it not playable, and `components/adhkar/AdhkarAudioControls.tsx:122` shows the "no audio" placeholder. So an adhkar build with no bundled audio needs no new UI.

## Decision

### 1. Move each asset map into its own module

| New module | Content | Read by |
| --- | --- | --- |
| `utils/audioAssets/adhkar.ts` | `export const adhkarAudioAssets: Record<string, number>`: the 425 entries that are now in `utils/adhkarAudio.ts:18` | `utils/adhkarAudio.ts` only |
| `utils/audioAssets/ambient.ts` | `export const ambientAudioAssets: Partial<Record<AmbientSoundType, number>>`: the 7 `require()` calls that are now in `types/ambient.ts` | `types/ambient.ts` only |
| `utils/audioAssets/empty.ts` | `export const adhkarAudioAssets = {}; export const ambientAudioAssets = {};` | Metro, in place of a pack that is off |

`utils/adhkarAudio.ts` keeps its public API (`getAudioSource`, `hasAudio`, `getAllAudioFiles`, `getAudioCount`) and reads `adhkarAudioAssets`. `AmbientSoundMeta.source` becomes `number | null`, from `ambientAudioAssets[type] ?? null`. The labels and icons stay in `types/ambient.ts`.

### 2. The config file

```js
// config/bundledAudio.config.js
/**
 * Fork seam (RFC-028): which audio packs this build bundles.
 *
 * Plain CommonJS with no imports, on purpose: metro.config.js reads it in
 * Node, and utils/audioAssets reads it at runtime. A change needs a new
 * native build and a Metro cache clear (`expo start --clear`).
 */
module.exports = {
  adhkar: true, // assets/audio/adhkar/ (43.3 MB)
  ambient: true, // assets/audio/ambient/ (8.1 MB)
};
```

This follows the shape of `config/nativeWidgets.config.js` (RFC-021): a plain CJS file that a fork replaces, read at build time and at runtime.

### 3. The Metro resolver

`metro.config.js` already wraps `resolveRequest` (`metro.config.js:22-30`). The wrapper resolves each request as it does now. Then, when the resolved file is the map of a pack that is off, it returns `utils/audioAssets/empty.ts` in its place:

```js
// config/bundledAudioResolver.js — pure, tested in Jest
const path = require('path');

const PACK_FILES = {
  adhkar: 'utils/audioAssets/adhkar.ts',
  ambient: 'utils/audioAssets/ambient.ts',
};

/** The file to use in place of `filePath`, or null to keep it. */
function bundledAudioStub(filePath, projectRoot, packs) {
  for (const [pack, file] of Object.entries(PACK_FILES)) {
    if (packs[pack] === false && filePath === path.join(projectRoot, file)) {
      return path.join(projectRoot, 'utils/audioAssets/empty.ts');
    }
  }
  return null;
}
```

The swap uses the resolved path, not the request text, so an `@/` alias and a relative import get the same result. Metro never reads the original map, so it never sees the `require()` calls of the MP3 files, and they do not go into the asset list.

### 4. Runtime rules

- **Adhkar off:** every dhikr is text only. `hasAudio()` returns `false`, and the existing placeholder shows. No UI change.
- **Ambient off:** the ambient sound picker and the Bedtime ambient option need sounds. A Jest test in `config/__tests__/` fails when `ambient` is `false` and `featureFlags.ambientAudioOverlay` is `true`, so a fork turns both off together. `AmbientAudioService.loadSound()` returns early when `source` is `null`, as it does now for an unknown sound type (`services/audio/AmbientAudioService.ts:99-103`).
- With both values `true`, the module graph has the same 432 files as now.

## Alternatives considered

- **Read `featureFlags.adhkar` in Metro.** `config/featureFlags.ts` is TypeScript, and `metro.config.js` runs in plain Node. It also joins two different choices: a build can show the adhkar text and not bundle its audio. Rejected.
- **A lazy `require()` or a dynamic `import()`.** Metro bundles every static `require()` in the graph, also inside a function. React Native has no code split for native assets. Rejected: it does not remove a byte.
- **The fork deletes the MP3 files or edits `utils/adhkarAudio.ts`.** A missing `require()` target fails the build, and the 484-line file conflicts at each upstream merge. Rejected.
- **A field in `config/branding.js`.** `app.config.js` reads `branding.js` in Node, so the field must be a function with a lazy `require()`. That puts asset packaging into the branding file, and a fork that copies Bayaan's `branding.js` gets all the files back. Rejected for a separate file, as RFC-021 did for the widgets.
- **Download the audio on demand from a CDN, for all builds.** It removes the 51.4 MB from Bayaan too. But it changes the product: morning and evening adhkar must play with no network, and it needs a download manager, a cache limit and a host. It is out of scope here. The seam does not block it (see "Open questions").

## Consequences

- **Positive:** a build with `adhkar: false` is 43.3 MB smaller, and with `ambient: false` 8.1 MB smaller. A fork that does not ship these features stops shipping their files, and it does not edit an upstream file.
- **Neutral:** Bayaan's defaults are `true`, so its bundle, APK and IPA keep the same files. The public API of `utils/adhkarAudio.ts` does not change.
- **Negative / risks:**
  - One more config file and one more branch in the Metro resolver.
  - After a change to the config, a stale Metro cache can still serve the old graph. The file comment says to run `expo start --clear`, and a native build starts from a clean cache.
  - A new file that imports a pack map directly would still work (the swap is by resolved path), but a new `require()` of an MP3 outside `utils/audioAssets/` would bypass the seam. A Jest test checks that only `utils/audioAssets/*.ts` names `assets/audio/adhkar/` or `assets/audio/ambient/`.

## How we'll know it worked

- Jest: `bundledAudioStub()` returns `empty.ts` only for a pack that is `false`, and `null` for every other path.
- Jest: no file outside `utils/audioAssets/` names `assets/audio/adhkar/` or `assets/audio/ambient/`.
- Bayaan defaults: `npx expo export --platform android` lists the same 432 audio assets as `develop` before the change.
- With both values `false`: the export lists 0 files from `assets/audio/adhkar/` and `assets/audio/ambient/`, and `unzip -l` of the release APK shows 0 of them in `res/raw/`. The APK is about 51 MB smaller.
- With `adhkar: false` on a device: the adhkar screens open, each dhikr shows the "no audio" placeholder, and the counter works.

## Open questions

- **A remote pack.** A later RFC can add a third value, for example `adhkar: {remote: '<base URL>'}`, where the map returns `{uri}` sources and the app keeps a disk cache. That needs `AdhkarPlaybackEngine.replace()` (`services/adhkar/playback/adhkarPlaybackEngine.ts:46`) to take an `AudioSource`, not only a `number`. This RFC does not decide it.
- **Bayaan's own size.** Whether Bayaan wants to move its adhkar audio off the binary is a product decision for Bayaan. This RFC keeps Bayaan's build as it is.
