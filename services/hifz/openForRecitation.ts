import {router} from 'expo-router';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

/**
 * Opens the mushaf at `page` with the text hidden, ready to recite from
 * memory with the mic. `at` selects an ayah on the page.
 */
export function openForRecitation(
  page: number,
  at?: {surah: number; ayah: number},
): void {
  const settings = useMushafSettingsStore.getState();
  if (!settings.recitationHideText) settings.toggleRecitationHideText();
  router.push({
    pathname: '/mushaf',
    params: at
      ? {surah: String(at.surah), ayah: String(at.ayah), page: String(page)}
      : {page: String(page)},
  });
}
