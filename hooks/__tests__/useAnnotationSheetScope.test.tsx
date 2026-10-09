jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hide: jest.fn(async () => undefined)},
}));
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {SheetManager} from 'react-native-actions-sheet';
import {useAnnotationSheetScope} from '../useAnnotationSheetScope';
import {useQfSyncStore} from '@/store/qfSyncStore';

let scope: ReturnType<typeof useAnnotationSheetScope>;
function Harness() {
  scope = useAnnotationSheetScope('verse-actions');
  return null;
}

test.each(['account-b', null])(
  'closes account A sheet and rejects a retained action after switching to %s',
  async accountId => {
    useQfSyncStore.getState().resetForTesting();
    useQfSyncStore.setState({activeAccountId: 'account-a'});
    jest.mocked(SheetManager.hide).mockClear();
    let screen!: renderer.ReactTestRenderer;
    await act(async () => {
      screen = renderer.create(<Harness />);
    });
    const retainedGuard = scope.isScopeCurrent;
    expect(retainedGuard()).toBe(true);
    await act(async () =>
      useQfSyncStore.setState({activeAccountId: accountId, scopeRevision: 1}),
    );
    expect(retainedGuard()).toBe(false);
    expect(scope.scopeIsCurrent).toBe(false);
    expect(SheetManager.hide).toHaveBeenCalledWith('verse-actions');
    await act(async () => screen.unmount());
  },
);
