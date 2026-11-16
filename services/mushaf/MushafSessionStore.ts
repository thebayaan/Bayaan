import {createMMKV} from 'react-native-mmkv';

const mmkv = createMMKV({id: 'mushaf-session'});

export const mushafSessionStore = {
  getLastScreenWasMushaf: (): boolean =>
    mmkv.getBoolean('lastScreenWasMushaf') ?? false,
  setLastScreenWasMushaf: (v: boolean): void =>
    mmkv.set('lastScreenWasMushaf', v),
  getLastReadPage: (): number | null => mmkv.getNumber('lastReadPage') ?? null,
  setLastReadPage: (p: number): void => mmkv.set('lastReadPage', p),
  // @ai-start
  // The Continue Reading line the widgets last showed for a page. A snapshot
  // taken before the Mushaf data loads reads it back.
  getLastOpeningText: (page: number): string =>
    mmkv.getNumber('lastOpeningPage') === page
      ? (mmkv.getString('lastOpeningText') ?? '')
      : '',
  setLastOpeningText: (page: number, text: string): void => {
    mmkv.set('lastOpeningPage', page);
    mmkv.set('lastOpeningText', text);
  },
  // @ai-end
};
