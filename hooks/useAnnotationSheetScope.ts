import {useCallback, useEffect, useRef} from 'react';
import {SheetManager} from 'react-native-actions-sheet';
import {useQfSyncStore} from '@/store/qfSyncStore';

export function useAnnotationSheetScope(
  sheetId: 'verse-actions' | 'verse-note' | 'verse-highlight',
) {
  const scopeRevision = useQfSyncStore(state => state.scopeRevision);
  const accountId = useQfSyncStore(state => state.activeAccountId);
  const original = useRef({scopeRevision, accountId});
  const isScopeCurrent = useCallback(() => {
    const current = useQfSyncStore.getState();
    return (
      current.scopeRevision === original.current.scopeRevision &&
      current.activeAccountId === original.current.accountId
    );
  }, []);
  const scopeIsCurrent = isScopeCurrent();
  useEffect(() => {
    if (!scopeIsCurrent) SheetManager.hide(sheetId).catch(() => undefined);
  }, [scopeIsCurrent, sheetId]);
  return {isScopeCurrent, scopeIsCurrent};
}
