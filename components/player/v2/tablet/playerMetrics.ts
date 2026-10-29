// @ai-generated
/**
 * Sizes of the iPad player (listening/02, "Proposed design"), from the
 * window width class: medium < 900, expanded 900-1279, large ≥ 1280.
 */

/** From this window width the player shows two panes. */
export const PLAYER_EXPANDED_MIN_WIDTH = 900;
const PLAYER_LARGE_MIN_WIDTH = 1280;

/** The reading column's width cap (ipad-standards §5.3). */
export const READING_COLUMN_MAX = 680;

/** Artwork never grows past this, however wide the column. */
const ART_MAX = 420;
/** Height the Now Playing column keeps for everything under the artwork. */
const COLUMN_CHROME_HEIGHT = 420;

/** Page margin for the window: 24 medium, 32 expanded, 40 large. */
export function playerPageMargin(windowWidth: number): number {
  if (windowWidth >= PLAYER_LARGE_MIN_WIDTH) return 40;
  return windowWidth >= PLAYER_EXPANDED_MIN_WIDTH ? 32 : 24;
}

/** Width of the Now Playing column: 40% of the window, kept to 380-520. */
export function nowPlayingColumnWidth(windowWidth: number): number {
  return Math.round(Math.min(520, Math.max(380, windowWidth * 0.4)));
}

/**
 * Artwork edge for the Now Playing column: as wide as the column allows, at
 * most 420, and short enough to keep the transport on screen in short
 * windows (mini landscape is 744 high).
 */
export function nowPlayingArtSize(
  columnWidth: number,
  margin: number,
  windowHeight: number,
): number {
  return Math.floor(
    Math.max(
      0,
      Math.min(
        columnWidth - 2 * margin,
        ART_MAX,
        windowHeight - COLUMN_CHROME_HEIGHT,
      ),
    ),
  );
}
