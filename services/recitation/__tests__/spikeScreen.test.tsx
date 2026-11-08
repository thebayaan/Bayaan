import React from 'react';
import {Text} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import RecitationSpikeRoute from '@/app/recitation-spike';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

// The screen lives in app/, so its test lives here.

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: {back: jest.fn()},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#000000', background: '#ffffff'}},
  }),
}));
jest.mock('@/services/recitation/recitationAssets', () => ({
  getRecitationAssets: jest.fn(async () => null),
  ensureRecitationAssets: jest.fn(),
  deleteRecitationAssets: jest.fn(),
}));
jest.mock('@/services/recitation/recitationEngine', () => ({
  createRecitationEngine: jest.fn(),
}));
jest.mock('@/services/recitation/micStream', () => ({
  requestMicPermission: jest.fn(),
  startMicStream: jest.fn(),
}));
// The size with the second look turned off.
jest.mock('@/constants/recitation', () => ({RECITATION_DOWNLOAD_MB: 75}));

// React Native's lazy requires run inside the first render, and take a while on a
// cold transform cache.
const FIRST_RENDER_MS = 30000;

describe('the hidden spike screen', () => {
  it(
    'lets the owner choose what the cancel step may cancel, and keeps the choice',
    async () => {
      let screen: ReactTestRenderer | undefined;
      await act(async () => {
        screen = create(<RecitationSpikeRoute />);
      });
      const root = (screen as ReactTestRenderer).root;
      const press = async (label: string) => {
        const button = root
          .findAll(node => node.props.accessibilityLabel === label)
          .find(node => typeof node.props.onPress === 'function');
        await act(async () => {
          button?.props.onPress();
        });
      };
      expect(
        useMushafSettingsStore.getState().recitationCancelMayCancel,
      ).toBeNull();
      await press('Cancel step: skipped marks only');
      expect(useMushafSettingsStore.getState().recitationCancelMayCancel).toBe(
        'skipped',
      );
      await press('Cancel step: all marks');
      expect(useMushafSettingsStore.getState().recitationCancelMayCancel).toBe(
        'all',
      );
    },
    FIRST_RENDER_MS,
  );

  it(
    'states the download size the rest of the app states',
    async () => {
      let screen: ReactTestRenderer | undefined;
      await act(async () => {
        screen = create(<RecitationSpikeRoute />);
      });
      const labels = (screen as ReactTestRenderer).root
        .findAll(node => (node.type as unknown) === Text)
        .map(text => [text.props.children].flat().join(''));
      expect(labels).toContain('Download model (~75 MB)');
    },
    FIRST_RENDER_MS,
  );
});
