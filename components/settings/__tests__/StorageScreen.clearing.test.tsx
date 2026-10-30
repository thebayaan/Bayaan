// @ai-generated
/**
 * Storage settings: while downloads or the cache are being cleared, both
 * action buttons are disabled, so a second tap cannot start another clear.
 * The screen lives in app/, so its test lives here.
 */
import React from 'react';
import {ActionSheetIOS} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

let resolveClear: (() => void) | undefined;
const mockClearAllDownloads = jest.fn(
  () =>
    new Promise<void>(resolve => {
      resolveClear = resolve;
    }),
);

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#eeeeee',
        border: '#dddddd',
      },
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

jest.mock('@/hooks/useStorageBreakdown', () => ({
  useStorageBreakdown: () => ({
    free: '1 GB',
    downloads: '1 GB',
    cache: '1 GB',
    otherApps: '1 GB',
    loading: false,
    error: null,
    rawData: {total: 4, free: 1, downloads: 1, cache: 1, otherApps: 1},
    refresh: jest.fn(),
  }),
}));

jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {
    getState: () => ({clearAllDownloads: mockClearAllDownloads}),
  },
}));

jest.mock('@/services/player/utils/storage', () => ({
  clearPlayerCache: jest.fn(() => Promise.resolve()),
}));

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

import StorageScreen from '@/app/(tabs)/(d.settings)/storage';

function actionButtons(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onPress === 'function',
    {deep: false},
  );
}

it('disables both actions while a clear is running', async () => {
  // On iPhone the confirmation is an action sheet; option 0 is the
  // destructive confirm.
  let choose: ((index: number) => void) | undefined;
  const sheetSpy = jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((_options, callback) => {
      choose = callback;
    });
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<StorageScreen />);
  });
  expect(actionButtons(tree)).toHaveLength(2);
  const [removeDownloads] = actionButtons(tree);
  act(() => removeDownloads.props.onPress());
  expect(sheetSpy).toHaveBeenCalledTimes(1);

  await act(async () => {
    choose?.(0);
  });

  expect(mockClearAllDownloads).toHaveBeenCalledTimes(1);
  for (const button of actionButtons(tree)) {
    expect(button.props.disabled).toBe(true);
  }

  await act(async () => {
    resolveClear?.();
  });
  for (const button of actionButtons(tree)) {
    expect(button.props.disabled).toBe(false);
  }
  sheetSpy.mockRestore();
});
