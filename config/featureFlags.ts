/**
 * Bayaan feature flags.
 *
 * All flags default to true — Bayaan ships every feature.
 * Forks override by replacing this file with their own values.
 *
 * These flags are for fork-configurable feature gating, not per-user A/B tests.
 * Use a runtime experiment framework for user-targeted rollouts.
 *
 * See docs/rfcs/007-app-layer-multi-tenancy.md.
 */
export const featureFlags = {
  adhkar: true,
  ambientAudioOverlay: true,
  userUploads: true,
  wordByWordTransliteration: true,
  pushNotifications: true,
  coloredHighlights: true,
  verseNotes: true,
  backgroundVideoOverlay: false, // deprecated; removed from UI
  multiTranslation: true,
  tafsir: true,
  sleepTimer: true,
  // @ai-start
  // The redesigned phone Home (components/home: Bayaan Now cover, Jump back
  // in, shelves). Off until it ships; the shelves Home (RecitersView) shows
  // instead. True turns it on for every build; otherwise the "home-redesign"
  // PostHog flag can turn it on remotely (services/remoteFlags).
  homeRedesign: false,
  // @ai-end
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/** Read a feature flag. Prefer this over direct object access. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
