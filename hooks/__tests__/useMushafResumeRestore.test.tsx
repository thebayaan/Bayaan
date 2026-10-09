jest.mock('expo-router', () => ({useRouter: () => ({push: mockPush})}));
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastScreenWasMushaf: () => true,
    getLastReadPage: () => {
      mockRead();
      return require('@/store/qfSyncStore').useQfSyncStore.getState()
        .activeAccountId
        ? 293
        : 1;
    },
  },
}));

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {InteractionManager} from 'react-native';
import {useMushafResumeRestore} from '../useMushafResumeRestore';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';
import {useQfSyncStore} from '@/store/qfSyncStore';

const mockPush = jest.fn();
const mockRead = jest.fn();
const onHandled = jest.fn();
function Harness() {
  useMushafResumeRestore(true, onHandled);
  return null;
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockPush.mockReset();
  mockRead.mockReset();
  onHandled.mockReset();
  useBayaanAuthStore.getState().resetForTesting();
  useQfSyncStore.getState().resetForTesting();
  jest
    .spyOn(InteractionManager, 'runAfterInteractions')
    .mockImplementation(callback => {
      if (typeof callback === 'function') callback();
      return {then: jest.fn(), done: jest.fn(), cancel: jest.fn()};
    });
});

test('waits for cold-start auth and then account scope, and resumes only once', async () => {
  let screen!: renderer.ReactTestRenderer;
  await act(async () => {
    screen = renderer.create(<Harness />);
  });
  expect(mockRead).not.toHaveBeenCalled();
  await act(async () =>
    useBayaanAuthStore.getState().setAuthenticated({accountId: 'account-a'}),
  );
  expect(mockRead).not.toHaveBeenCalled();
  await act(async () =>
    useQfSyncStore.setState({activeAccountId: 'account-a'}),
  );
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/mushaf',
    params: {page: '293'},
  });
  expect(onHandled).toHaveBeenCalledTimes(1);
  await act(async () => useQfSyncStore.getState().refreshData());
  expect(mockRead).toHaveBeenCalledTimes(1);
  await act(async () => screen.unmount());
});

test('resumes the guest page only after signed-out restoration settles', async () => {
  let screen!: renderer.ReactTestRenderer;
  await act(async () => {
    screen = renderer.create(<Harness />);
  });
  expect(mockRead).not.toHaveBeenCalled();
  await act(async () => useBayaanAuthStore.getState().setSignedOut());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/mushaf',
    params: {page: '1'},
  });
  await act(async () => screen.unmount());
});

test('annotation request effect never invokes settings sync', () => {
  const source = require('fs').readFileSync(
    `${process.cwd()}/app/_layout.tsx`,
    'utf8',
  );
  const effect = source.slice(
    source.indexOf('if (syncRequestId > 0)'),
    source.indexOf('}, [syncRequestId]'),
  );
  expect(effect).toContain('qfSyncLifecycle.requestSync()');
  expect(effect).not.toContain('qfSettingsSyncLifecycle.requestSync()');
});
