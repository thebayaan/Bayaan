/**
 * Native widget surfaces (iOS WidgetKit, Android Glance) and the feature
 * flags each one needs. A surface ships only when
 * config/nativeWidgets.config.js `widgets` lists it (absent = all) and every
 * flag it needs is on.
 *
 * CJS with no imports: plugins/withBayaanWidgets.js requires it at prebuild
 * to compile disabled widgets out (iOS) and hide them from the picker
 * (Android); services/widgets uses it at runtime to skip their work.
 *
 * See docs/rfcs/021-native-widget-seams.md.
 */

/** Every surface, in a stable order. The last four are iOS-only. */
const NATIVE_WIDGET_IDS = [
  'ContinueListening',
  'ContinueReading',
  'QuickSurah',
  'PinnedReciter',
  'AyahOfTheDay',
  'Tasbeeh',
  'RecentlyPlayed',
  'LibraryShelf',
  'Bedtime',
  'ReciterSpotlight',
  'Adhkar',
  'HijriDate',
  'Occasion',
  'BayaanNow',
  'ListeningAccessory',
  'LiveActivity',
  'PlaybackControl',
  'PlaySurahControl',
];

/** Surfaces that exist on Android (the rest are iOS-only). */
const ANDROID_WIDGET_IDS = NATIVE_WIDGET_IDS.slice(0, 14);

/** Feature flags (config/featureFlags.ts) a whole surface depends on. */
const NATIVE_WIDGET_FLAGS = {
  // The Tasbeeh counter is the adhkar store's dhikr counts.
  Tasbeeh: ['adhkar'],
  Adhkar: ['adhkar'],
  // The Bedtime widget's job is to start a sleep timer.
  Bedtime: ['sleepTimer'],
};

/**
 * Parts of a surface that follow a flag while the surface itself stays:
 * Bayaan Now's adhkar and bedtime cards, and the Bedtime widget's ambient
 * sound option.
 */
const NATIVE_WIDGET_FEATURES = {
  adhkar: 'adhkar',
  sleepTimer: 'sleepTimer',
  ambient: 'ambientAudioOverlay',
};

function isFlagOn(flags, flag) {
  return !flags || flags[flag] !== false;
}

/**
 * @param {readonly string[] | undefined} widgets nativeWidgets.config.js `widgets`
 * @param {Readonly<Record<string, boolean>> | undefined} flags `featureFlags`
 */
function resolveNativeWidgets(widgets, flags) {
  const listed = Array.isArray(widgets) ? new Set(widgets) : null;
  const enabled = NATIVE_WIDGET_IDS.filter(
    id =>
      (listed === null || listed.has(id)) &&
      (NATIVE_WIDGET_FLAGS[id] ?? []).every(flag => isFlagOn(flags, flag)),
  );
  const features = {};
  for (const [feature, flag] of Object.entries(NATIVE_WIDGET_FEATURES)) {
    features[feature] = isFlagOn(flags, flag);
  }
  return {enabled, features};
}

module.exports = {
  NATIVE_WIDGET_IDS,
  ANDROID_WIDGET_IDS,
  NATIVE_WIDGET_FLAGS,
  NATIVE_WIDGET_FEATURES,
  resolveNativeWidgets,
};
