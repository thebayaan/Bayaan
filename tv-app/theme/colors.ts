/**
 * TV color tokens, aligned to the Bayaan mobile brand.
 *
 * The TV app is a dark 10-foot UI, so it maps the mobile dark scheme
 * (`styles/colorSchemes.ts` -> `darkColors`): deep-ink backgrounds with the
 * brand cream (`lightColors.background`) inverted onto them for text. No
 * deprecated `primary` / `accent` colors are used here.
 */
export const colors = {
  // Brand deep-ink backgrounds (mobile darkColors.background / backgroundSecondary).
  background: '#050b10',
  backgroundSecondary: '#06151c',
  // Card and elevated surfaces, toned to the same ink family for clear depth.
  surface: '#06151c',
  surfaceElevated: '#0e2530',
  // Brand cream text (mobile lightColors.background) plus muted steps.
  text: '#f4f3ec',
  textSecondary: '#b0b0b0',
  textTertiary: '#6e7a80',
  // Hairline / divider (mobile darkColors.border).
  border: '#332f38',
  // Neutral bright focus ring (Spotify-style brand cream, not an accent color).
  focusRing: '#f4f3ec',
  // Scrims for cinematic artwork overlays, built from the brand ink.
  overlayScrim: 'rgba(5,11,16,0.6)',
  scrimStrong: 'rgba(5,11,16,0.92)',
} as const;
