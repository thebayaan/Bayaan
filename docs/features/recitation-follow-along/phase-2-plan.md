# Phase 2 plan: make Follow my recitation shippable

Built from phase-2-app-research.md and phase-2-engine-research.md.
Decisions: never behind a paywall (NPL-1.2); R2 mirror deferred; mic lives in
the mushaf bottom bar; user-facing name "Follow my recitation".

| # | Work | Status |
|---|---|---|
| 1 | Persisted mushaf setting replaces the dev toggle; model state and remove in settings; spike screen dev-only | done |
| 2 | Lifecycle: wait out expo-audio's delayed deactivation, interruption stop, 3 s no-audio watchdog, Android audio focus, stop on any Quran playback (AudioCoordinator, covers CarPlay), Open Settings on denied permission | done |
| 3 | 37:130 word override | done |
| 4 | State: `debug: true` engine events give searching / following / lost; bar and iOS 26 toolbar show Stop plus "Finding your place…" or "Ya-Sin 36:4", Play hidden while listening | done |
| 5 | Engine quick wins: `enableFallback: false`, verdict memo + observe guard + Set cleanup patch (identical output on 4 surahs; jitless 10 to 42% faster) | done |
| 6 | Recited ayat tint (under all layers, DK pages and vertical mushaf); band in QCF and reading views; word tint in ContinuousMushafView; Hafs-only gate | done (recited tint not in QCF or list views yet) |
| 7 | Unload: 1 min after leaving the mushaf, 5 min after a take, at once on memory warning | done |
| 8 | First run: intro sheet (on device, audio stays on the phone, 75 MB), mic permission before download, progress; What's New entry | |
| 9 | Analytics: started, locked (time to lock), stopped (duration, ayat, reason, rtf), download started/completed/failed, error | |
| 10 | Native fbank Expo module (C++ core), parity-tested against JS | |
| 11 | Android device pass (RTF, input gain preset, memory, APK size) | needs a device and disk space |
