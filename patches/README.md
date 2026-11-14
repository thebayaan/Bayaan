# Native tab direction

Expo SDK 57+ / React Native Screens 4.26+ support native tab direction. Bayaan
passes `unstable_nativeProps={{direction: appDirection}}` to `NativeTabs`,
placing Home on the right and the separate Search button on the left in Arabic
while keeping the normal platform design. No Screens patch is required.

The Yoga wrapper remains LTR to preserve the native mini-player accessory's
coordinates; screen and player contents apply the selected app direction.
Language changes persist the native direction. Android relaunches the app
process to apply it; iOS applies it the next time the app is opened. The app
is never reloaded in process (see i18n/language.ts).

When upgrading Router or Screens, verify Arabic and English tab order, Search
placement, tab switching, and regular/minimized mini-player accessories.

# expo-audio lock screen next/previous

`expo-audio+58.0.10.patch` adds opt-in next/previous track commands for a
single `AudioPlayer` to the lock screen (iOS `MPRemoteCommandCenter`, Android
media session `SEEK_TO_NEXT` / `SEEK_TO_PREVIOUS`). Upstream SDK 58 only offers
these for `AudioPlaylist`; the patch plugs into the same `supportsNextTrack` /
`nextTrack()` hooks. A player opts in per activation with
`setActiveForLockScreen(..., {trackControls: {previous, next}})`, updates them
with `setLockScreenTrackControls`, and receives `lockScreenTrackCommand`
events. Players that do not opt in behave as upstream. Adhkar playback is the
only user (`services/audio/LockScreenService.ts`).

On iOS the patch also stops upstream from claiming `nextTrackCommand` /
`previousTrackCommand` for players that did not ask for them. Upstream 58
registers failing targets and disables both commands on every activation,
which would take next/previous away from the CarPlay Now Playing screen
(`modules/bayaan-car/ios/CarNowPlaying.swift`).

Expo ships expo-audio prebuilt (an xcframework on iOS, an AAR in
`local-maven-repo` on Android), which would ignore the patch, so
`package.json` sets `expo.autolinking.buildFromSource: ["expo-audio"]`.
When upgrading expo-audio, regenerate the patch against the new version and
keep that setting.

# react-native-draggable-flatlist drag state

`react-native-draggable-flatlist+4.0.3.patch` fixes three ways a drag left
stale state behind in the iPad queue (`components/player/v2/tablet/QueuePane.tsx`,
the only user):

- A row dropped where it started changes no data, so upstream never reset
  the drag. The next drag of that row started from the old scroll offset and
  landed rows away from the finger. The patch resets after a drop in place.
- A plain scroll of the list wrote its distance into the drag offset. The patch
  only tracks the pan while a row is lifted.
- When the scroll view took a touch from a lifted row, the pan ended without
  `onEnd` or a touch up, so the row stayed lifted and the next swipe dragged
  it. The patch ends the touch on cancel and finalize, which drops the row
  in place.

Metro reads the package's `src` (its `react-native` field), so only `src` is
patched. When upgrading the library, check whether these are fixed upstream
before regenerating the patch.

# @tilawa/core recitation engine

`@tilawa+core+0.4.0.patch` changes the package's `dist` only. What each change is
for is said beside it in the code. Beyond the earlier speed and flag fixes it adds:

- `recitation/junction.js`: did the reader say an ayah's last word? Runs in
  correction mode when the session is given `junction`.
- `gapReport` in the engine config: extra sounds heard between two words, reported
  as `gap` on the right word's verdict, for the added-word mark.
- `recitation/melFrames.js` and `session.readMelFrames`: the last 10 s or so of the
  stream's log-mel frames, so a second model needs no second FFT.
- `session.wordFrames`: a word's first and last tracker frames as known now. Both of
  these count on one clock for the whole take. The decoder starts from 0 again when the
  engine goes idle or finishes a surah; these do not.
- `tracer.verdicts`: the last stretch is aligned once a chunk, not on each of the 4 or 5
  calls, with two rows of costs in memory. The verdicts are the same. The gap report runs
  only on the call that reads it.
- `cutAtJump` in the engine config: a forward jump of more than this many places in the
  text starts a new stretch of alignment. Off when left out. It changes verdicts near
  such a jump.
- The structural rules (skipped and look-alike ayahs) at the end of a take: they ran in
  one piece and held the JS thread for 7.5 s on a 111 s take at 2:215 with a voice behind
  (Hermes on a Mac). They now run in slices of about 12 ms with a pause between them, and
  do less: only the look-alike candidates the pick can choose are timed (in each ayah by
  falling margin until one passes, and never one whose best fit anywhere in the take
  already fails), each one's alignment is read from its own ayah on, and the edit-cost
  steps read each char's costs once. The flags are the same. On that take the stop takes
  2 s, no piece over 50 ms, and its peak memory fell from about 800 MB to 290 MB. Hermes
  runs code in a generator's own body slowly, so the step generators only loop over units
  and yield; the work is in plain functions.

With none of `junction`, `gapReport` and `cutAtJump` passed, the engine behaves as it
did before them. Their numbers were tuned on the model's output, so the patch holds none: the
caller passes them from `services/recitation/followerConstants.npl.json`.

To change the patch, make the new `dist` on a copy, then diff it against the
published package in a scratch git repo laid out as `node_modules/@tilawa/core`:
`git diff --cached --no-color --ignore-space-at-eol --no-ext-diff --src-prefix=a/
--dst-prefix=b/`, which is what patch-package writes. Do not reinstall the package
in the repo to do this: its `prepare` script rebuilds it from source that is not
there. Check the result on a clean copy with `patch-package --error-on-fail`.
