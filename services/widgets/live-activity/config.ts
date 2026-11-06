// services/widgets/live-activity/config.ts
// Quran playback no longer starts a Live Activity (adhkar playback spec,
// section 7): the lock screen player covers it. The 'surah' and 'ayah' code
// paths stay compiled and tested. To bring the surah activity back, set
// QURAN_LIVE_ACTIVITY_MODE to 'surah'. 'ayah' adds the current ayah and
// updates on every ayah change; keep it off until the device prototype in
// docs/superpowers/plans/2026-10-11-widgets-phase-2-device-checklist.md passes.
// A fork that lists LiveActivity out (RFC-021) compiles every activity out of
// the widget extension, so both gates are off there too.
import {isWidgetEnabled, widgetFeatures} from '../enabledWidgets';

export type LiveActivityMode = 'off' | 'surah' | 'ayah';

const QURAN_LIVE_ACTIVITY_MODE: LiveActivityMode = 'off';

export function liveActivityMode(): LiveActivityMode {
  return isWidgetEnabled('LiveActivity') ? QURAN_LIVE_ACTIVITY_MODE : 'off';
}

/** The adhkar session Live Activity also needs the adhkar feature. */
export function adhkarLiveActivityEnabled(): boolean {
  return isWidgetEnabled('LiveActivity') && widgetFeatures.adhkar;
}
