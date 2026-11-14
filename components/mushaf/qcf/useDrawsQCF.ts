// @ai-generated
import {useSyncExternalStore} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

const servedRewayah = () =>
  digitalKhattDataService.initialized ? digitalKhattDataService.rewayah : null;

/**
 * Whether mushaf pages draw Mushaf 1440's glyphs: the reader chose Mushaf
 * 1440 and the text served is Hafs. Its printed glyphs are Hafs only, so
 * another rewayah's text is drawn with the Madani (DigitalKhatt) font on the
 * same pages, and Mushaf 1440 stays the reader's choice. Follows the text
 * the data service actually serves, never a rewayah still loading.
 */
export function useDrawsQCF(): boolean {
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const rewayah = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    servedRewayah,
  );
  return renderer === 'qcf_v2' && rewayah === 'hafs';
}
