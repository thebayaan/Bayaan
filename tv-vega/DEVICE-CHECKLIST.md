# Vega (Fire TV) device checklist

Things the shared tv-app cannot verify off a device. Run them on a Vega
Fire TV before a release and note the result here.

## Screensaver during playback

`hooks/useKeepAwakeWhile.kepler.ts` is a no-op: Vega has no documented
wake-lock or screensaver API.

1. Play a long surah (Al-Baqarah) from the player and leave the remote alone
   past the device's screensaver timeout (Settings > Display & Sounds >
   Screensaver; set it to 5 minutes for the test).
2. Expected: the screensaver does not start while audio plays (the media
   session may hold the screen awake). Note what happens.
3. Open Adhkar, count in the reader without audio, and wait past the timeout
   the same way. The screensaver starting here is the known gap.

If the screensaver covers the player, look again for a Vega screen-wake API
and implement the hook with it.

## Storage

`services/storage.kepler.ts` (logic in `services/storageVega.ts`):

1. Create a playlist, love a surah, add a favourite reciter. Force-stop the
   app and relaunch: all three are still there and onboarding does not show.
2. Play a surah with verse text and a translation, relaunch, and play it
   again: the verse text appears (timings and translations load on demand,
   not at launch).
3. If launch logs `[storage] hydrate failed`, the session runs without saving;
   relaunch and check the library is intact.
