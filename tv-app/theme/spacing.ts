/**
 * 10-foot spacing and corner-radius scale for the TV UI.
 *
 * Deliberately larger than the mobile 7pt unit (`styles/theme.ts`): TV layouts
 * are viewed from across a room, so the rhythm is an 8pt-based scale.
 */
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 40,
  xl: 64,
  xxl: 96,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  // Fully rounded: circular artwork / avatars and pill-shaped chips.
  pill: 999,
} as const;
