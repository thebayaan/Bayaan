import {createMMKV} from 'react-native-mmkv';
import {mushafVerseMapService} from './MushafVerseMapService';
import {qfReadingSessionService} from '@/services/sync/qfReadingSessionService';

const mmkv = createMMKV({id: 'mushaf-session'});

export const mushafSessionStore = {
  getLastScreenWasMushaf: (): boolean =>
    mmkv.getBoolean('lastScreenWasMushaf') ?? false,
  setLastScreenWasMushaf: (v: boolean): void =>
    mmkv.set('lastScreenWasMushaf', v),
  getLastReadPage: (): number | null => mmkv.getNumber('lastReadPage') ?? null,
  setLastReadPage: (p: number): void => {
    mmkv.set('lastReadPage', p);
    try {
      const firstVisibleVerse =
        mushafVerseMapService.getOrderedVerseKeysForPage(p)[0];
      if (firstVisibleVerse) {
        qfReadingSessionService.recordVisibleVerse(firstVisibleVerse);
      }
    } catch {
      // The synchronous MMKV resume cache remains available while data loads.
    }
  },
};
