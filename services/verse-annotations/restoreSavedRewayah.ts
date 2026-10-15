// @ai-generated
// Moved unchanged from app/(tabs)/(c.collection)/collection/bookmarks.tsx
// (restoreBookmarkRewayah) so that every way of opening a saved verse (the
// Bookmarks list and the bookmark chips of the mushaf search) restores its
// rewayah the same way before selecting the verse.
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {hasTextData} from '@/services/rewayah/RewayahIdentity';
import {
  REWAYAH_FALLBACK_RENDERER_LABEL,
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
import {showToast} from '@/utils/toastUtils';

/**
 * Switches to the rewayah a bookmark was saved in before it opens, keeping
 * the settings store and the DigitalKhatt data service on the same rewayah.
 *
 * Mushaf 1440 (qcf_v2) draws Hafs only and the store refuses a non-Hafs
 * rewayah there. Switching the data service anyway left it on the saved
 * rewayah while the store said Hafs: Allah-name highlights were projected
 * from the wrong words, and after a later switch back to a DigitalKhatt font
 * pages drew that text under a Hafs header and saved Hafs layouts built from
 * it. So under Mushaf 1440 the data service is left alone and the verse opens
 * in Hafs, and the reader is told so.
 */
export async function restoreSavedRewayah(
  savedRewayah: RewayahId | undefined,
): Promise<void> {
  // Legacy bookmarks carry no rewayah and open in whatever is active.
  if (!savedRewayah) return;
  const settings = useMushafSettingsStore.getState();
  if (
    savedRewayah === settings.rewayah &&
    savedRewayah === digitalKhattDataService.rewayah
  ) {
    return;
  }
  const savedLabel = getRewayahShortLabel(savedRewayah);
  if (settings.mushafRenderer === 'qcf_v2' && savedRewayah !== 'hafs') {
    showToast(
      'Opening in Hafs',
      `Saved in ${savedLabel}. Mushaf 1440 shows Hafs only.`,
    );
    return;
  }
  if (!hasTextData(savedRewayah)) {
    showToast(
      `${savedLabel} text is not available`,
      `Opening in ${getRewayahShortLabel(settings.rewayah)}.`,
      'error',
    );
    return;
  }
  try {
    await digitalKhattDataService.switchRewayah(savedRewayah);
  } catch (err) {
    console.error('[Bookmarks] Failed to switch rewayah:', err);
    // Put the data service back on the store's rewayah if the failed switch
    // moved it (a no-op when the service rolled back by itself).
    if (digitalKhattDataService.rewayah !== settings.rewayah) {
      await digitalKhattDataService
        .switchRewayah(settings.rewayah)
        .catch(restoreErr =>
          console.error('[Bookmarks] Failed to restore rewayah:', restoreErr),
        );
    }
    showToast(
      `Couldn't open in ${savedLabel}`,
      `Showing ${getRewayahShortLabel(settings.rewayah)} instead.`,
      'error',
    );
    return;
  }
  const rendererBefore = settings.mushafRenderer;
  // setRewayah also moves IndoPak to a Madani font (IndoPak draws Hafs only).
  useMushafSettingsStore.getState().setRewayah(savedRewayah);
  if (useMushafSettingsStore.getState().mushafRenderer !== rendererBefore) {
    showToast(
      `Opening in ${savedLabel}`,
      `IndoPak shows Hafs only, so the font is now ${REWAYAH_FALLBACK_RENDERER_LABEL}.`,
    );
  } else {
    showToast('Opening in', savedLabel);
  }
}
