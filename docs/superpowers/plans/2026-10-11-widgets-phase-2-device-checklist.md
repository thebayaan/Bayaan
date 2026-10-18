# Widgets Phase 2: Device Checklist Results

Plan: `docs/superpowers/plans/2026-10-11-widgets-phase-2.md` (Task 10).

Environment:
- iOS: iPhone 17 Pro simulator with Dynamic Island, iOS 26.2 ("Bayaan Widgets", B68030CC), Xcode 27, Release build via xcodebuild (`build-recipe.md`), installed over the existing app (data and placed widgets kept). `DYLD_INSERT_LIBRARIES` cleared before launches. The simulator was rebooted once mid-run (the argent transport died); nothing else was reset.
- Shipping mode: `liveActivityMode()` returns `'surah'`.
- Run date 2026-10-11 local.
- Screenshots: `.superpowers/sdd/widgets-overnight/screens-2/`.

Status key: PASS, PARTIAL, FAIL, PENDING.

## Simulator

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Lock Screen Live Activity | PASS | Played Al-Kahf (Mishary Alafasi) in the foreground and locked. The activity shows the surah card, "Al-Kahf", the reciter, a pause button, a moving bar and a countdown on the dark tile with the Bayaan mark. iOS asked "continue to allow Live Activities" on first lock; answered Always Allow. The card first rendered as an empty tile: fixed by `b33353fd` (thumbnail decode) and re-verified. `ios-live-activity-lockscreen.png`. |
| 2 | Dynamic Island compact and expanded | PASS | Backgrounded: compact shows the card and a circular progress ring; paused shows a static pause glyph. Long-press expands to card, names, pause button, bar and countdown. `ios-dynamic-island-compact.png`, `ios-dynamic-island-expanded.png`. |
| 3 | Pause and play from the expanded island | PASS | Pause stopped audio (snapshot `isPlaying` false) and the activity switched to a static bar and "32m left" within about 2 s; play resumed with the countdown running. Deferred Task 3 item confirmed: "2h 6m left" wrapped onto a clipped second line in the fixed 52 pt frame; fixed by `38d1dbde` (paused label sizes to fit, island bottom row padded) and re-verified ("1h 11m left" on one line, `ios-dynamic-island-expanded-paused.png`). |
| 4 | Track change updates the same activity | PASS | Al-Fatihah auto-advanced to Al-Baqarah, then Next in the player moved to Ali 'Imran: the island and Lock Screen showed one activity whose card, title and countdown changed each time. |
| 5 | Seek forward 5 minutes | PASS | Twenty +15 s taps in the player (5 min): the bar and countdown jumped once (1:17:08 to 1:11:48 remaining) and kept moving. |
| 6 | Activity ends with the queue | PASS | Let the last queued track (An-Nasr) finish: the activity disappeared from the island. The explicit queue-clear path was not exercised (covered by `syncLiveActivity` tests). |
| 7 | Orphan cleanup after termination | PASS | Played Al-Mulk, terminated the app (`simctl terminate`; the stale activity stayed while the app was dead), relaunched without playing: the old activity was gone and no new one appeared for the restored paused session. |
| 8 | Swipe-away suppression | PASS | Swiped the Lock Screen activity away (Clear) during Al-Baqarah: it stayed away after lock and unlock. Next track (Ali 'Imran) with the app in the foreground brought it back. |
| 9 | Settings toggle | PASS | Settings > Apps > Bayaan > Live Activities off, played An-Nasr: no activity. On again, changed track (An-Nas): the activity appeared. |
| 10 | Control Center controls | PASS | Added "Play or Pause" and "Play Surah" from the Bayaan section, configured Play Surah to Ya-Sin through the surah picker. Play Surah played Ya-Sin with Mishary Alafasi (default reciter); the toggle then read "Playing" (pause glyph) and a tap paused playback (value back to "Paused"). Note: right after adding, the toggle read "Paused" while An-Nasr sat at its end with the snapshot still `isPlaying: true`; effective playback treats a position past the duration as not playing, so the value was right. `ios-control-center-controls.png`. |
| 11 | Shortcuts app | PARTIAL | The Bayaan section lists Pause, Resume and one Play Surah shortcut per surah (Al-Fatihah, Al-Baqarah, ...). Running Al-Mulk played Al-Mulk with Mishary; Pause paused (position held at 21 s); Resume resumed from 21 s. Not run: Resume with the queue cleared (no reliable queue-clear path through the tooling; the branch is `PlaybackResume.action`, covered by `check-widget-system-surfaces.sh`). `ios-shortcuts-app.png`. |
| 12 | Quick Surah regression | PARTIAL | The shared surah picker (seen through the Play Surah control) lists "Al-Kahf" with subtitle "18 · The Cave" and filters by name ("Ya-Sin", "36 · Ya Sin"). Not re-checked: an existing configured Quick Surah widget (none on the visible Home Screen pages). |
| 13 | Phase 1 regression | PASS | Continue Listening medium: play and pause in place with the app in the background (island ring appeared and went back to the pause glyph). Lock Screen Now Listening accessories kept updating ("Al-Baqarah · 2:04:59", "Ali 'Imran · 1h 11m left"). |
| 14 | Prebuild reproduces the project | PASS | `npm run prebuild` (clean) then the recipe build (with the Pods deployment-target fix): `** BUILD SUCCEEDED **`. `ios/Bayaan/BayaanAppShortcuts.swift` regenerated, 4 pbxproj references, Task 9 metadata check prints `3 0`. Prebuild drift (versions, EXUpdates, App Links entitlement, Podfile.lock, android/) is pre-existing and was stashed as `widgets2-prebuild-drift-task10` (ba153685), not committed. |
| 15 | StandBy | PENDING | The simulator cannot charge, so StandBy cannot be entered; see P6. No screenshot. |

### Fixes made during the run

- `b33353fd` Decode a thumbnail for the Live Activity artwork. The 900 px cached surah card rendered as an empty tile inside the activity (the plan's named fallback); the activity now decodes a thumbnail with ImageIO at three times the displayed size. Widgets keep the full image.
- `38d1dbde` Keep the Live Activity countdown on one line. The paused "Xh Ym left" label wrapped inside the fixed 52 pt frame (Task 3 deferred item); only the timer Text keeps the fixed width now, and the expanded island's bottom row has horizontal padding so the label clears the rounded corner.

## Needs a real phone

| # | Check | Result | Protocol |
|---|-------|--------|----------|
| P1 | `ayah` mode prototype (gate for P2-R1) | PENDING | Physical iPhone with a Dynamic Island, iOS 17 or later, Release build, not attached to the Xcode debugger. Locally change `liveActivityMode()` to return `'ayah'` (do not commit). Play Al-Baqarah with Mishary Alafasy (Hafs, has timestamps), lock, screen record the Lock Screen. Compare the ayah line with the audio at 1, 5 and 10 minutes. Repeat on battery, with Low Power Mode on, and once after switching to another app first. PASS: within one ayah of the audio at every observation in every run; record the time of the last observed change if it stalls. On PASS, flip the default in a separate commit `feat(widgets): show the current ayah in the Live Activity`; on FAIL, keep `'surah'`. |
| P2 | Redundancy with system Now Playing (P2-R1) | PENDING | Default `'surah'` mode: look at the Lock Screen and island while playing. If the activity reads as a duplicate of the system Now Playing card, record it and propose `'off'` until P1 passes. (On the simulator both cards appear stacked on the Lock Screen.) |
| P3 | Background start (P2-R2) | PENDING | Kill the app, start playback from the Continue Listening widget, the Play Surah control and Siri. Expected: no activity until the app is opened, then the activity appears. Record whether any start succeeded in the background. |
| P4 | Siri voice | PENDING | "Play Al Kahf in Bayaan", "Play Surah Yasin in Bayaan", "Play The Cave in Bayaan", "Pause Bayaan", "Resume Bayaan". |
| P5 | Action Button | PENDING | Assign each control under Settings > Action Button > Controls and press it. |
| P6 | StandBy (P2-R16) | PENDING | Charging, landscape, locked: small widgets and the Live Activity render legibly, including night mode (red tint). |
| P7 | Cold start from a control or Siri | PENDING | As 1a item 1 (60 s command window). |

## Open items

- Resume with an empty queue (item 11) and an existing Quick Surah widget (item 12) not exercised on the simulator.
- When the last track ends, the snapshot can keep `isPlaying: true` with the position at the duration; consumers that use effective playback handle it, but a direct `isPlaying` reader would not.
