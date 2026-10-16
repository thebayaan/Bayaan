// How the R2 surah cards sit in the app's tiles (see brand/SurahArtwork).

/** The cards are 1200 x 630 with the calligraphy and name in the middle. */
const CARD_ASPECT = 1200 / 630;
/** Share of the slot's width the card's middle should fill. */
const CONTENT_SHARE = 0.4;
/** Least share of the card's height left visible, so the name never clips. */
const MIN_HEIGHT_SHARE = 0.45;

/**
 * How far to zoom the card into a slot of the given aspect (width / height)
 * so its calligraphy reads at tile size instead of floating small in the
 * middle of a mostly empty card. 1 means plain cover.
 */
export function surahArtworkZoom(slotAspect: number): number {
  if (!(slotAspect > 0)) return 1;
  const visibleWidth = Math.min(1, slotAspect / CARD_ASPECT);
  const visibleHeight = Math.min(1, CARD_ASPECT / slotAspect);
  const zoom = Math.min(
    visibleWidth / CONTENT_SHARE,
    visibleHeight / MIN_HEIGHT_SHARE,
  );
  return Math.max(1, Math.round(zoom * 100) / 100);
}
