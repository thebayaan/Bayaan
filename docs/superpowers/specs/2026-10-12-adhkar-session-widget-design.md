# Adhkar Session Widget: Design

Date: 2026-10-12
Status: Draft, awaiting review

## Goal

Let people complete the morning or evening adhkar from the Home Screen without opening Bayaan: move through every dhikr in order, count repetitions, and play the audio from any card.

## Decisions (from the user)

- The medium and large Adhkar widgets become the interactive session. There is no separate widget.
- A small circular counter counts repetitions.
- When a dhikr does not fit, show the opening and send the reader to the app for the rest. The large widget shows the full text whenever it fits.
- Tapping anywhere that is not a button opens the adhkar screen scrolled to the current dhikr. On the first card it opens at the top.

## Scope

| Family | Behavior |
| --- | --- |
| Small | Unchanged: the featured dhikr, English-only title, tap opens the adhkar screen. |
| Medium | Interactive session, Arabic only, two to three lines. |
| Large | Interactive session, Arabic plus translation, full text when it fits. |

Bayaan Now's adhkar mode renders the same view, so the session works there too.

Both platforms: iOS (WidgetKit + App Intents, iOS 17+) and Android (Glance actions). Neither platform gets swipe gestures. iOS widgets have none, and Android stays consistent with iOS.

## Layout (medium and large)

```
+--------------------------------------------+
| Morning Adhkar           4 of 24      logo |
| ====------------------------------------   |  progress bar
|                                            |
|     <dhikr, Digital Khatt, right-aligned>  |
|     <translation (large only)>             |
|     Read the rest in Bayaan ->  (if cut)   |
|                                            |
|  <     [ Play all | Play ]     ( 3 )     > |
+--------------------------------------------+
```

- **Prev and next** buttons (`<` and `>`) move one card. Prev is hidden on card 1. Next on the last card shows the completed state.
- **Counter ring** shows the repetitions left for this card, with the ring filling as you count. Each tap decrements it. At zero the widget advances to the next card. For a dhikr said once, the ring shows a check and one tap advances.
- **Play button** reads "Play all" on card 1 and "Play" on any other card (Phase 2).
- **Completed state:** "Morning Adhkar completed", a "Start again" button, and a tap that opens the adhkar screen.
- **Body tap** opens `adhkar/<superId>?dhikr=<id>`, or `adhkar/<superId>` on card 1.

## Data

`targets/widgets/adhkar-periods.json` currently holds only a featured subset. `scripts/generate-widget-data.ts` will add the full ordered list per period. The Android copy is generated the same way. Each item has:

- `id`, `arabic`, `translation`, `repeatCount`, `audioFile`
- `fits`: `{ medium: boolean, large: boolean }`, precomputed from a character budget per family

The budgets are calibrated once on device (iPhone 14 Pro and a Pixel-size emulator) and stored as constants in the generator. Precomputing keeps the widgets free of runtime text measurement and keeps the two platforms identical. The featured subset stays for the small widget.

## Session state

The app group holds one record per period, in UserDefaults on iOS and the existing WidgetStorage on Android:

```
{ period, dayKey, index, remaining, completed }
```

- `dayKey` together with `period` scopes the record. When the current period or day differs from the stored one, the session resets to card 1. Periods come from the existing `ContentLogic.adhkarPeriod`.
- `remaining` is the counter for the current card. It resets to `repeatCount` whenever `index` changes.
- In v1 the widget owns this progress, and the in-app screen does not read or write it. Syncing the two is a possible follow-up.

## Interactions

New intents, following the Tasbeeh pattern (`IncrementTasbeehIntent`):

| iOS AppIntent | Android ActionCallback | Effect |
| --- | --- | --- |
| `AdhkarNextIntent` | `AdhkarNextAction` | `index + 1` (or complete) |
| `AdhkarPrevIntent` | `AdhkarPrevAction` | `index - 1` |
| `AdhkarCountIntent` | `AdhkarCountAction` | `remaining - 1`; at 0 behaves like Next |
| `AdhkarRestartIntent` | `AdhkarRestartAction` | back to card 1, not completed |

Each intent writes the state and reloads the `Adhkar` and `BayaanNow` widget kinds. The first time a session is completed, it records `adhkar_session_completed` (defined, never fired today). The widget extension has no analytics, so it queues the event in the app group and the app flushes it on next launch.

## Audio (Phase 2)

Adhkar audio today plays through `AdhkarAudioProvider` (expo-audio), which only exists while the adhkar screen is mounted. A widget cannot reach it while the app is closed.

Phase 2 routes widget-started adhkar playback through the main player in `services/player`, the path `PlayTrackIntent` already uses through the widget command queue. That path already supports background launch, the lock screen and the Live Activity.

- `PlayAdhkarIntent(period, fromIndex)` is an AudioPlaybackIntent. It enqueues a `playAdhkar` command, and the app builds a queue of the bundled adhkar mp3s (from `utils/adhkarAudio.ts`) starting at `fromIndex`.
- The queue items carry the dhikr id, so on track change the app writes `index` back to the session state and reloads the widget. That way the widget follows along.
- In-app Play All keeps using `AdhkarAudioProvider`. Unifying the two is out of scope.
- Risk: bundled asset playback through the main player has to be verified on device for both platforms before building the widget side.

## App change: deep link to a dhikr

`app/(tabs)/(a.home)/adhkar/[superId]/index.tsx` accepts an optional `dhikr` search param. After the list lays out, it calls `scrollToIndex` on that dhikr, with `onScrollToIndexFailed` falling back to `scrollToOffset` via the average item height. Without the param, behavior is unchanged.

## Phasing

1. **Phase 1:** full-list data and fit flags, the session view (medium and large), the four intents, session state with reset, the deep link, and the completion event. iOS and Android together.
2. **Phase 2:** `PlayAdhkarIntent`, main-player adhkar queue, and widget follow-along. Starts with an on-device spike of bundled-mp3 playback.

## Testing

- **Unit:** session reducer (next, prev, count, restart, reset on period or day change) as pure functions on both platforms, with one shared vectors file in `modules/bayaan-widgets/src/__fixtures__`.
- **Generator:** every item has `repeatCount >= 1`, ids are unique, and the fit flags are stable.
- **Device checklist:** count through a 3x dhikr; advance past a long dhikr to see the cut and the link; the deep link scrolls to position, and card 1 opens at the top; the period rollover resets the session; completed state and restart; Bayaan Now in the adhkar window shows the session.
