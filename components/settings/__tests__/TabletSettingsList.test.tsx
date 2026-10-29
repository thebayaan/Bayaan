// @ai-generated
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', textSecondary: '#555555'}},
  }),
}));
jest.mock('@/store/devSettingsStore', () => ({
  useDevSettingsStore: () => ({
    showFloatingDevMenu: false,
    toggleFloatingDevMenu: jest.fn(),
  }),
}));
jest.mock('@/store/analyticsConsentStore', () => ({
  useAnalyticsConsentStore: () => ({
    analyticsEnabled: true,
    setAnalyticsEnabled: jest.fn(),
  }),
}));
jest.mock('@/components/settings/ThemePicker', () => ({
  ThemePicker: () => null,
}));
jest.mock('@/components/Icons', () => new Proxy({}, {get: () => () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 20, left: 0, right: 0}),
}));
jest.mock('expo-router', () => ({useRouter: () => ({push: jest.fn()})}));
jest.mock('@/utils/reviewUtils', () => ({
  markAsRated: jest.fn(),
  openAppStoreForReview: jest.fn(),
}));

import {TabletSettingsList} from '../TabletSettingsList';

function render(props: React.ComponentProps<typeof TabletSettingsList>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<TabletSettingsList {...props} />);
  });
  return renderer;
}

const texts = (node: TestRenderer.ReactTestInstance) =>
  node
    .findAll(n => (n.type as unknown) === Text)
    .map(n => [n.props.children].flat().join(''));

/** The row whose title is `title`. */
const row = (r: TestRenderer.ReactTestRenderer, title: string) =>
  r.root.find(
    n =>
      typeof n.props.onPress === 'function' &&
      !!n.props.accessibilityRole &&
      texts(n)[0] === title,
  );

describe('TabletSettingsList', () => {
  it('marks the page beside the list and drops the row captions', () => {
    const r = render({onOpenPage: jest.fn(), selectedRoute: 'storage'});
    expect(row(r, 'Storage').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(row(r, 'Language').props.accessibilityState).toEqual({
      selected: false,
    });
    expect(texts(row(r, 'Storage'))).toEqual(['Storage']);
  });

  it('shows captions when the list stands alone', () => {
    const r = render({onOpenPage: jest.fn()});
    expect(texts(row(r, 'Storage')).length).toBe(2);
  });

  it('moves the analytics note under its group in the split', () => {
    const note = (r: TestRenderer.ReactTestRenderer) =>
      texts(r.root).filter(s => s.startsWith('Help improve'));
    const switchRow = (r: TestRenderer.ReactTestRenderer) =>
      r.root.find(
        n => n.props.accessibilityLabel === 'Share anonymous usage data',
      ).parent as TestRenderer.ReactTestInstance;

    const split = render({onOpenPage: jest.fn(), selectedRoute: 'storage'});
    expect(note(split)).toHaveLength(1);
    expect(texts(switchRow(split))).toEqual(['Share anonymous usage data']);

    const alone = render({onOpenPage: jest.fn()});
    expect(note(alone)).toHaveLength(1);
    expect(texts(switchRow(alone))).toHaveLength(2);
  });

  it('opens pages by route name and keeps links announced as links', async () => {
    const onOpenPage = jest.fn();
    const r = render({onOpenPage, selectedRoute: 'storage'});
    await act(async () => {
      await row(r, 'Language').props.onPress();
    });
    expect(onOpenPage).toHaveBeenCalledWith('language');
    expect(row(r, 'Privacy Policy').props.accessibilityRole).toBe('link');
  });
});
