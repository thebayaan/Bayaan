/**
 * TV color tokens, aligned to the Bayaan mobile brand.
 *
 * The TV app is a dark 10-foot UI, so it maps the mobile dark scheme
 * (`styles/colorSchemes.ts` -> `darkColors`): deep-ink backgrounds with the
 * brand cream (`lightColors.background`) inverted onto them for text. No
 * deprecated `primary` colors are used here; `accent` is the TV brand sky
 * taken from the app icon, not the mobile `darkColors.accent`.
 */
export const colors = {
  // Brand deep-ink backgrounds (mobile darkColors.background / backgroundSecondary).
  background: '#050b10',
  backgroundSecondary: '#06151c',
  // Card and elevated surfaces, toned to the same ink family for clear depth.
  surface: '#06151c',
  surfaceElevated: '#0e2530',
  // Brand cream text (mobile lightColors.background) plus muted steps, all
  // cream at lower strength so greys stay warm instead of neutral.
  text: '#f4f3ec',
  textSecondary: 'rgba(244,243,236,0.62)',
  textTertiary: 'rgba(244,243,236,0.4)',
  // Hairline / divider, cream at low strength.
  border: 'rgba(244,243,236,0.12)',
  // Ink & Cream focus: one treatment everywhere, a cream fill with ink on it.
  focusFill: '#f4f3ec',
  onFocus: '#06151c',
  // Dark enough to read from the sofa on cream (small tool labels).
  onFocusSecondary: 'rgba(6,21,28,0.8)',
  // Hairline outline for a screen's main action at rest: faint enough never
  // to read as a second focus beside the real one.
  outline: 'rgba(244,243,236,0.3)',
  // Brand sky from the app icon, for indicators only: the selected tab's
  // underline, section labels (every tracked uppercase kicker above a title,
  // on every screen), live state and checks. Never a focus fill.
  accent: '#8dc9d6',
  // Logo ink: text and icons drawn on top of the sky accent.
  accentInk: '#101820',
  // Sky at low opacity for selected-but-not-focused states.
  accentSoft: 'rgba(141,201,214,0.18)',
  // Focus ring for artwork (cards, portraits), where a fill would hide it.
  focusRing: '#f4f3ec',
  // Scrims for cinematic artwork overlays, built from the brand ink.
  overlayScrim: 'rgba(5,11,16,0.6)',
  scrimStrong: 'rgba(5,11,16,0.92)',
} as const;
