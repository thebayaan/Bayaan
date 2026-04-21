import {createMMKV} from 'react-native-mmkv';

const mmkv = createMMKV({id: 'mushaf-session'});

export const mushafSessionStore = {
  getLastScreenWasMushaf: (): boolean =>
    mmkv.getBoolean('lastScreenWasMushaf') ?? false,
  setLastScreenWasMushaf: (v: boolean): void =>
    mmkv.set('lastScreenWasMushaf', v),
  getLastReadPage: (): number | null => mmkv.getNumber('lastReadPage') ?? null,
  setLastReadPage: (p: number): void => mmkv.set('lastReadPage', p),
};
