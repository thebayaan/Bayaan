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
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/** Read a feature flag. Prefer this over direct object access. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
