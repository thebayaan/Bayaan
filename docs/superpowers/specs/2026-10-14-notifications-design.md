# Notifications and Reminders: Design Spec

**Date:** 2026-10-14
**Status:** Approved design, pending spec review
**Platforms:** iOS and Android. Web and TV do not show the Notifications screen.

## 1. Why this exists

Bayaan has never sent a notification. We want to start, but intentionally: low volume, high value, no streak-shaming or "we miss you" nags. Every notification exists because the user asked for it.

Users must be able to:

- Turn any single notification on or off, or all of them at once.
- Create their own reminders to read or listen, starting from presets.

Daily goals were deliberately cut from Profile/Activity v1 so they could land here, since a goal without a reminder loses most of its value.

### Design principles

1. Nothing is on by default. Permission is only requested after the user has chosen something on our own screen.
2. Reminders are the core model. Built-in items (adhkar, Al-Kahf) are presets of the same reminder, not separate features.
3. Conditional notifications (goal nudge) are cancelled the moment they stop being true.
4. One plan, many triggers: the schedule is computed from settings by a pure function and reconciled against the OS, so it repairs itself.
5. Phase 1 is local only, built so server announcements slot in later without changing the opt-in model.

## 2. Phasing

- **Phase 1 (this spec):** on-device scheduled notifications: reminders, daily goal nudge, Islamic occasions. No backend, no Firebase.
- **Phase 2 (outlined in section 9):** server-sent announcements as a fourth opt-in group.

### Out of scope for phase 1

- Server push of any kind.
- Quiet hours.
- Per-occasion toggles (one switch covers all occasions).
- Quran.Foundation goal sync (revisit when the QF branches merge; QF allows one goal per account).
- Prayer-time-based scheduling (the app has no prayer times or location).

## 3. Current state

- `expo-notifications ~57.0.22` is installed and its config plugin is set in `app.config.js` (icon `assets/images/notification_icon.png`). `UIBackgroundModes` includes `remote-notification`. Nothing calls the library.
- `utils/notificationUtils.ts` (permission request, Expo push token, a MAX importance `default` Android channel) is dead code. `config/featureFlags.ts` has an unused `pushNotifications` flag.
- No Firebase config, no push tokens, no backend push tables, no background task libraries.
- Deep links (scheme `bayaan`, expo-router file routing) already exist for `/player`, `/quran/{surah}`, `/mushaf/{page}`, `/reciter/{slug}/{surah}?rewayah=` (starts playback), `/reciter/{id}`, `/adhkar`, `/adhkar/{superId}`.
- `app/_layout.tsx` restores the last mushaf page on launch unless `Linking.getInitialURL()` returns a URL. Notification taps do not set it, so the two would conflict.
- Known bug: a cold start via `bayaan://player` does not open the full player (`docs/superpowers/plans/2026-10-08-widgets-phase-1a-device-checklist.md`).
- `services/analytics/LocalAggregationStore.ts` (MMKV) records per-day `listeningMs` and `pagesRead`, and has an unused `getListeningGoal` / `setListeningGoal` (default 10 min). It writes regardless of analytics consent.
- `services/mushaf/MushafSessionStore.ts` holds `lastReadPage`. `services/player/utils/resumeRecent.ts` resumes the last track.
- `trackAdhkarSessionCompleted` exists on `AnalyticsService` but is never called.
- Islamic occasion logic lives in JS in `modules/bayaan-widgets/src/contextRules.ts`, tested against `__fixtures__/hijri.table.json`, but Hijri conversion only exists in native widget code (`ContentLogic.swift`, `IcuHijri.kt`).
- Settings rows are built inline in `app/(tabs)/(d.settings)/index.tsx` from `getSettingsSections(t)`. Stores are zustand + `persist` + AsyncStorage (pattern: `store/analyticsConsentStore.ts`). i18n is i18next with `en` and `ar` locales; RTL is supported.
- No time picker dependency. `components/sheets/SelectReciterSheet.tsx` can be reused.
- Onboarding does not exist yet. It is planned and will be shown to all users, including existing users on update.

## 4. Data model

New store `store/notificationsStore.ts` (zustand `persist` on AsyncStorage, with `schemaVersion` for migrations).

```ts
type ClockTime = { hour: number; minute: number }; // local wall clock
type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type ReminderAction =
  | { type: 'continueReading' }
  | { type: 'continueListening' }
  | { type: 'adhkar' }
  | { type: 'readSurah'; surah: number }
  | { type: 'listenSurah'; surah: number; reciterId: string; rewayatId?: string };

type ReminderPreset =
  | 'morningAdhkar'
  | 'eveningAdhkar'
  | 'kahf'
  | 'dailyReading'
  | 'dailyListening';

type Reminder = {
  id: string;
  enabled: boolean;
  preset?: ReminderPreset;
  label?: string;
  time: ClockTime;
  weekdays: Weekday[]; // all 7 = daily
  action: ReminderAction;
};

type Slot = { enabled: boolean; time: ClockTime };

type NotificationPrefs = {
  remindersEnabled: boolean; // Reminders master toggle
  reminders: Reminder[]; // max 8
  goalNudge: Slot;
  occasions: Slot;
  offersShown: Partial<Record<OfferId, number>>; // bell first-use hints
};
```

### Defaults

| Item | Default |
|---|---|
| `remindersEnabled` | false |
| `reminders` | empty (onboarding adds the presets the user picks) |
| Morning adhkar preset | 06:30, every day, action `adhkar` |
| Evening adhkar preset | 17:30, every day, action `adhkar` |
| Al-Kahf preset | Friday 10:00, action `readSurah` 18 |
| Daily reading / listening presets | every day, user picks the time |
| `goalNudge` | off, 20:00 |
| `occasions` | off, 09:00 |

The `preset` tag lets a bell find its reminder and lets onboarding avoid duplicates. A preset only pre-fills the editor; every field stays editable.

### Daily goals

Two independent optional goals:

- Listening minutes per day: Off, 5, 10, 15, 20, 30, 45, 60.
- Pages per day: Off, 1, 2, 5, 10, 20.

Targets live in `LocalAggregationStore`, next to the existing `listeningGoal`, because goals are an activity concept that the future Profile/Activity hub will read. The notifications store holds only the nudge toggle and time.

One combined nudge covers whatever is unmet (e.g. "4 min of listening and 2 pages left today"). If both goals are met, nothing fires.

### Limits

Reminders are capped at 8. A reminder on specific weekdays uses one OS slot per weekday, so the cap keeps the worst case under the iOS limit of 64 pending notifications.

## 5. Scheduling engine

Local notifications cannot evaluate conditions when they fire, and iOS allows 64 pending per app. Everything is decided ahead of time by a planner and applied by a reconciler.

### `services/notifications/planner.ts`

Pure function `planNotifications(input): PlannedNotification[]`.

- **Input:** prefs, `now`, today's goal status (`listeningMs`, `pagesRead`, targets), upcoming occasions, an injected `t` for localized copy.
- **Output:** each item has a deterministic Bayaan-prefixed ID (`bayaan.reminder.<id>.<weekday>`, `bayaan.occasion.ramadan.1448`, `bayaan.goal.2026-10-13`), a trigger, and content `{ title, body, data }`.
- **Triggers:**
  - Reminders use repeating OS triggers: one DAILY trigger if all 7 days are selected, otherwise one WEEKLY trigger per weekday.
  - Occasions are dated one-shots for the next 60 days.
  - Goal nudges are dated one-shots for the next 7 days. Today's is omitted if the goal is met or the nudge time has passed.
- **Budget:** if the total exceeds 60, the lowest priority items are dropped first: occasions, then goal nudges. Reminders are kept longest.
- **Reminders master off** removes only reminders. Goal and occasions are unaffected.
- No I/O.

### `services/notifications/reconciler.ts`

- Reads `getAllScheduledNotificationsAsync`, diffs against the plan by ID and content hash (the hash is in `data`), cancels stale items, schedules missing ones.
- Runs are serialized; overlapping calls never race.
- Without permission, it cancels all Bayaan-prefixed notifications and schedules nothing.
- It never touches notifications without the Bayaan prefix.

### When it runs

- App launch, after stores hydrate.
- App returns to the foreground.
- Any prefs change (debounced).
- Goal progress change. When `AnalyticsService` records listening or pages and a goal becomes met, reconcile runs immediately and today's nudge is cancelled. Progress only happens while the app runs, so a nudge cannot fire after the goal is met.

### Islamic occasions

- Occasion logic reuses `contextRules.ts`.
- Hijri conversion: the plan starts with a verification step. If Hermes `Intl` supports the `islamic-umalqura` calendar on both platforms, use it. Otherwise add `hijriDates(from, days)` to the `bayaan-widgets` native module, reusing `IcuHijri.kt` and the Swift calendar code, so widgets and notifications always agree.
- Fires on: 1 Ramadan, the day the last ten nights begin ("begin tonight"), Arafah, Eid al-Fitr, Eid al-Adha, Ashura.
- Copy is hedged ("expected to begin") because Umm al-Qura dates can differ from local moon sighting by a day.

### Android

- One channel per group (Reminders, Goal, Occasions) at DEFAULT importance. Users get native per-group switches in system settings.
- Remove the MAX importance `default` channel from `utils/notificationUtils.ts`.
- Inexact alarms are acceptable. Do not request `SCHEDULE_EXACT_ALARM`.

### Localization

Copy is rendered at plan time in the current language. Changing language reloads the app; hashes change and the reconciler reschedules everything.

## 6. Permissions

### Primary ask: onboarding

The upcoming onboarding flow (shown to all users) includes a "Stay connected" step, built in phase 1 as a self-contained component `NotificationSetupStep`:

- Lists the presets with suggested times; the user picks on our screen first.
- **Turn on** fires the OS prompt, then enables exactly what was picked.
- **Skip** never fires the OS prompt. iOS allows the prompt only once, so it is saved for someone who already said yes.

Notifications ships first with this component ready. Onboarding mounts it when it is built.

### Fallbacks

`ensurePermission()` also runs when the user enables anything in Settings > Notifications or taps a bell.

### Denied and revoked

- Denied (including Android's can't-re-prompt state): the toggle stays off and an inline banner says notifications are blocked for Bayaan, with an **Open Settings** button (`Linking.openSettings()`).
- Revoked later in system settings: the banner shows on the Notifications screen and the reconciler schedules nothing. When permission returns, the next reconcile restores everything, since prefs were never lost.

### Details

- Request alert and sound only. No badge.
- On iOS, include `providesAppNotificationSettings` so iOS Settings shows a link that opens the Notifications screen.

### Bells at the content

- A bell on the adhkar screen and on the Al-Kahf / Friday surface creates or edits the matching preset reminder.
- First-use hint per bell shown at most once (`offersShown`), at most one hint per session, 7 day cooldown, never if permission is denied.
- Wire up real adhkar session completion detection (`trackAdhkarSessionCompleted` is never called today). This also fixes the analytics gap.

## 7. Settings > Notifications screen

Entry: a new "Notifications" row (bell icon) in `getSettingsSections` in `app/(tabs)/(d.settings)/index.tsx`, opening `app/(tabs)/(d.settings)/notifications.tsx`. No other changes to `index.tsx`. Hidden on web and TV.

```
Notifications
[banner only if OS permission is blocked]

REMINDERS                        [master]
  06:30  Morning adhkar   Every day  [on]
  17:30  Evening adhkar   Every day  [off]
  10:00  Surah Al-Kahf    Fri        [on]
  21:00  Continue reading Sun-Thu    [on]
  + Add reminder

DAILY GOAL
  Listening      15 min     >
  Reading        2 pages    >
  Evening nudge  20:00      [on]

ISLAMIC OCCASIONS               [on]
  Ramadan, last ten nights, Arafah, Eid, Ashura.
  Next: Ramadan, around <date>
```

- The Reminders master pauses all reminders without deleting them. Each reminder has its own toggle.
- The goal nudge is disabled until a goal is set and turns on by default once one is.
- Goal and Occasions have their own toggles and ignore the Reminders master.
- There is no global in-app master. The OS toggle is "everything off". Phase 2 adds Announcements as a fourth group.

### Add reminder and editor

- **Add reminder** first shows presets: Morning adhkar, Evening adhkar, Surah Al-Kahf on Friday, Daily reading, Daily listening, Custom. Disabled at 8 reminders with a short hint.
- Editor route: `notifications/reminder/[id].tsx` (`new` creates).
  - **Action:** Continue reading, Continue listening, Adhkar, Read a surah (surah picker), Listen to a surah (surah, plus reciter and rewayah via `SelectReciterSheet`, defaulting to the last played reciter).
  - **Time:** native time picker.
  - **Days:** 7 chips in locale order.
  - **Label:** optional; empty means a localized default for the action.
  - Save, or Delete when editing.
- Notification copy is generic and stable ("Continue where you left off"). It never includes page numbers, which could be stale.

### Implementation notes

- New dependency: `@react-native-community/datetimepicker` (native module, requires a rebuild). Chosen over a JS wheel picker for native feel, 12/24h and Arabic support.
- New components in `components/notifications/`: `TimeSlotRow`, `ReminderRow`, `DayChips`, `PermissionBanner`, `NotificationSetupStep`. They match existing settings row visuals; the existing settings screen is not refactored.
- All copy goes in a new `notifications` i18n namespace (`en` and `ar`), registered in `i18n/resources.ts`. Layout respects RTL.

## 8. Taps and deep links

### Payload

`data: { v: 1, kind: 'reminder' | 'goal' | 'occasion', action?, reminderId?, hash }`

- Destinations are resolved at tap time, never baked in at schedule time.
- Validated with type guards. Malformed payloads or unknown versions open Home.

### Handler

`services/notifications/responseHandler.ts`, mounted once in the root layout:

- Cold start: `getLastNotificationResponseAsync`.
- Warm: `addNotificationResponseReceivedListener`.
- Sets a launched-from-notification flag that the mushaf restore logic in `app/_layout.tsx` checks, so restore never overrides the tap.

### Routing

| Notification | Destination |
|---|---|
| Continue reading | `/mushaf/{lastReadPage}` from `MushafSessionStore` at tap time; page 1 if none |
| Continue listening | `resumeRecent`, then open the player |
| Adhkar | Morning or evening adhkar category for those presets; adhkar home otherwise |
| Read a surah | `/quran/{surah}` |
| Listen to a surah | `/reciter/{slug}/{surah}?rewayah=…` (starts playback) |
| Goal nudge | Resume listening if listening is unmet, otherwise continue reading |
| Occasion | Home |

Listen reminders auto-play on tap: the user chose "listen" and tapping is deliberate.

**Prerequisite:** fix the cold-start full player bug so Continue listening lands on the full player.

### Foreground presentation

Banner, no sound, no badge.

### Analytics

Consent-gated through the existing `AnalyticsService`:

- `notification_permission_result { granted, source: 'onboarding' | 'settings' | 'bell' }`
- `reminder_created`, `reminder_updated`, `reminder_deleted { preset, action }`
- `reminders_master_toggled`, `occasions_toggled`
- `goal_set { listenMin, pages }`
- `notification_opened { kind, preset, action }`

Reminder labels are never sent; they are user-written text.

## 9. Phase 2: server announcements (outline only)

- **Mobile:** Firebase config for Android plus APNs credentials. Choose Expo's push service (`getExpoPushTokenAsync` already available) or direct APNs/FCM from the backend when phase 2 starts.
- **Backend:** `push_devices` table (token, platform, locale, timezone, topics, app version, last seen) keyed by the anonymous device ID; no account required. `POST` / `DELETE /v1/push/register`, plus an admin topic send endpoint with localized copy and rate limiting.
- **App:** an Announcements group on the Notifications screen, off by default. The token is registered only when it is turned on and deleted when it is turned off, so the server only knows opted-in devices.

### Phase 1 seams that keep phase 2 cheap

- The payload `kind` union extends with `'announcement'`.
- `responseHandler` already routes internal paths; phase 2 adds an allowlist for server-provided paths.
- The new prefs field arrives through a `schemaVersion` migration.
- An `announcements` Android channel is added.
- No change to screen layout or opt-in model.

## 10. Testing

### Unit (Jest)

- **Planner:** preset to trigger mapping; weekday mapping to the library's numbering (Sunday = 1); budget truncation priority; today's goal nudge omitted when met or past; 60 day occasion window; Reminders master off removes only reminders; occasion dates match `__fixtures__/hijri.table.json`.
- **Reconciler** with mocked `expo-notifications`: correct diff; a second run is a no-op; only prefixed IDs are touched; runs are serialized.
- Payload guards, tap destination resolution, store migrations.

### Device QA

Argent on the iOS simulator and an Android emulator, plus the cloud simulator builds (PR #333, GitHub Actions + Maestro):

- A reminder scheduled 1 minute out fires.
- Cold and warm taps route correctly, and mushaf restore does not override them.
- Denied permission shows the banner.
- Android channels appear in system settings.
- Arabic copy and RTL layout.

### Dev tools

Dev settings only: **Fire test notification** and **Show scheduled** (lists what the OS has pending).

## 11. Open items

- Hijri conversion path (Hermes `Intl` vs native bridge), settled by a verification step at the start of the plan.
- Phase 2 push provider choice.
- Onboarding mounts `NotificationSetupStep` when onboarding is built.
