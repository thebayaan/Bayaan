// @ai-generated
/**
 * Keeps the shared verse data (utils/enhancedVerseData) on the translation
 * selected in settings.
 *
 * The verse data is built with Saheeh International when the app loads. It
 * used to be rebuilt for the selected translation only by the audio player's
 * verse list, which is not mounted until a track is loaded. So the Mushaf
 * list view showed Saheeh under the selected translation's name, and a
 * downloaded translation was missing from copy and share after a restart.
 *
 * This runs with the app instead of with a screen: once at startup (after
 * the translations database is open, so a downloaded translation can be
 * read) and again on every change of the setting, including the one made by
 * the saved settings arriving from storage.
 */
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {rebuildEnhancedVerses} from '@/utils/enhancedVerseData';

let following = false;

function applySelectedTranslation(): void {
  // Never rejects: a translation that cannot be read falls back to Saheeh.
  void rebuildEnhancedVerses(
    useMushafSettingsStore.getState().selectedTranslationId,
  );
}

/**
 * Applies the selected translation now and after every change. Safe to call
 * more than once. Not awaited by startup: reading a downloaded translation
 * (6,236 rows) must not hold the splash screen, and the screens showing
 * verses follow the rebuild when it lands.
 */
export function followSelectedTranslation(): void {
  if (following) return;
  following = true;
  useMushafSettingsStore.subscribe((state, previous) => {
    if (state.selectedTranslationId !== previous.selectedTranslationId) {
      applySelectedTranslation();
    }
  });
  applySelectedTranslation();
}
