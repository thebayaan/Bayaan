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

/**
 * Layout of every root screen (the places beside the sidebar), in design
 * pixels. One left/right gutter for titles, tab rows and the first column of
 * rails and grids, so switching tabs never shifts the page; it also keeps
 * content inside the TV's overscan-safe area. Cells that reserve room for a
 * focus ring pull their padding out of it so the artwork edge, not the
 * reserved space, lines up with the title.
 */
export const SCREEN_GUTTER = spacing.xl;

/** Where a root screen's clock sits: top edge, and right edge. */
export const SCREEN_CLOCK_TOP = 52;
export const SCREEN_CLOCK_RIGHT = SCREEN_GUTTER;
