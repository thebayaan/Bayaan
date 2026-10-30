// @ai-generated
/**
 * Storage settings: while downloads or the cache are being cleared, both
 * action buttons are disabled, so a second tap cannot start another clear.
 * The screen lives in app/, so its test lives here.
 */
import React from 'react';
import {Alert, AlertButton} from 'react-native';
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
      typography: {bodySize: 16, mediumSize: 14, smallSize: 12},
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
  const alertSpy = jest.spyOn(Alert, 'alert');
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<StorageScreen />);
  });
  expect(actionButtons(tree)).toHaveLength(2);
  const [removeDownloads] = actionButtons(tree);
  act(() => removeDownloads.props.onPress());
  expect(alertSpy).toHaveBeenCalledTimes(1);

  const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
  const confirm = buttons.find(b => b.style === 'destructive')!;
  await act(async () => {
    confirm.onPress?.();
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
  alertSpy.mockRestore();
});
