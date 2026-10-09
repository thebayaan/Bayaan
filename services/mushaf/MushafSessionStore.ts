import {createMMKV} from 'react-native-mmkv';
import {mushafVerseMapService} from './MushafVerseMapService';
import {qfReadingSessionService} from '@/services/sync/qfReadingSessionService';
import {useQfSyncStore} from '@/store/qfSyncStore';

const mmkv = createMMKV({id: 'mushaf-session'});

function lastReadPageKey(accountId: string | null): string {
  return accountId ? `lastReadPage:qf:${accountId}` : 'lastReadPage';
}

function lastReadPageUpdatedAtKey(accountId: string): string {
  return `${lastReadPageKey(accountId)}:updatedAt`;
}

export const mushafSessionStore = {
  getLastScreenWasMushaf: (): boolean =>
    mmkv.getBoolean('lastScreenWasMushaf') ?? false,
  setLastScreenWasMushaf: (v: boolean): void =>
    mmkv.set('lastScreenWasMushaf', v),
  getLastReadPage: (): number | null =>
    mmkv.getNumber(
      lastReadPageKey(useQfSyncStore.getState().activeAccountId),
    ) ?? null,
  setLastReadPage: (p: number): void => {
    const accountId = useQfSyncStore.getState().activeAccountId;
    mmkv.set(lastReadPageKey(accountId), p);
    if (!accountId) return;
    const updatedAt = Math.max(
      Date.now(),
      (mmkv.getNumber(lastReadPageUpdatedAtKey(accountId)) ?? 0) + 1,
    );
    mmkv.set(lastReadPageUpdatedAtKey(accountId), updatedAt);
    let firstVisibleVerse: string | undefined;
    try {
      firstVisibleVerse =
        mushafVerseMapService.getOrderedVerseKeysForPage(p)[0];
    } catch {
      // The synchronous MMKV resume cache remains available while data loads.
    }
    qfReadingSessionService.recordPageIntent(firstVisibleVerse, updatedAt);
  },
  getLastReadPageUpdatedAt: (accountId: string): number | null =>
    mmkv.getNumber(lastReadPageUpdatedAtKey(accountId)) ?? null,
  setLastReadPageFromSync: (
    accountId: string,
    p: number,
    updatedAt?: number,
  ): void => {
    if (useQfSyncStore.getState().activeAccountId !== accountId) return;
    mmkv.set(lastReadPageKey(accountId), p);
    if (updatedAt !== undefined) {
      mmkv.set(lastReadPageUpdatedAtKey(accountId), updatedAt);
    }
  },
};
