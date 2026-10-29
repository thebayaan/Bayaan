# Native tab direction

Expo SDK 57 / React Native Screens 4.26 support native tab direction. Bayaan
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

`expo-audio+57.0.5.patch` adds opt-in next/previous track commands to the lock
screen (iOS `MPRemoteCommandCenter`, Android media session `SEEK_TO_NEXT` /
`SEEK_TO_PREVIOUS`). A player opts in per activation with
`setActiveForLockScreen(..., {trackControls: {previous, next}})`, updates them
with `setLockScreenTrackControls`, and receives `lockScreenTrackCommand`
events. Players that do not opt in behave as upstream. Adhkar playback is the
only user (`services/audio/LockScreenService.ts`).

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
