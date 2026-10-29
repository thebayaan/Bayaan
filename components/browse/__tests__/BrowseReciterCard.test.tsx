import React from 'react';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {StyleSheet} from 'react-native'; // @ai
import {BrowseReciterCard} from '@/components/browse/BrowseReciterCard';
import type {Reciter} from '@/data/reciterData';
import type {Theme} from '@/utils/themeUtils';

// Stand-in for expo-router's Link so the test can see where a card links to.
jest.mock('expo-router', () => {
  const {View} = jest.requireActual('react-native');
  const MockLink = ({children, href}: {children: unknown; href: unknown}) => (
    <View testID="profile-link" href={href}>
      {children}
    </View>
  );
  MockLink.AppleZoom = ({children}: {children: unknown}) => children;
  return {Link: MockLink};
});
jest.mock('expo-glass-effect', () => ({
  GlassView: ({children}: {children: unknown}) => children,
}));
jest.mock('@/hooks/useGlassProps', () => ({
  USE_GLASS: false,
  useGlassColorScheme: () => 'light',
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/badges/FollowAlongBadge', () => ({
  FollowAlongBadge: () => null,
}));
jest.mock('@/components/Icons', () => ({PlayIcon: () => null})); // @ai

const theme = {
  colors: {text: '#111111', textSecondary: '#666666'},
} as unknown as Theme;

const reciter = {
  id: 'reciter-1',
  name: 'Test Reciter',
  image_url: null,
  rewayat: [{id: 'rw-1', name: "Hafs A'n Assem"}],
} as unknown as Reciter;

let mounted: ReactTestRenderer | undefined;

function render(
  props: Partial<React.ComponentProps<typeof BrowseReciterCard>> = {},
): ReactTestRenderer {
  act(() => {
    mounted = TestRenderer.create(
      <BrowseReciterCard
        reciter={reciter}
        onPress={jest.fn()}
        width={100}
        height={120}
        theme={theme}
        {...props}
      />,
    );
  });
  if (!mounted) throw new Error('not rendered');
  return mounted;
}

// The choice card is the only element exposed as a button.
function chooseButton(r: ReactTestRenderer) {
  return r.root.find(
    n =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function',
  );
}

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

it('links to the reciter profile by default', () => {
  const r = render({rewayatId: 'rw-1'});
  const link = r.root.findByProps({testID: 'profile-link'});
  expect(link.props.href).toEqual({
    pathname: '/(tabs)/(a.home)/reciter/[id]',
    params: {id: 'reciter-1', rewayatId: 'rw-1'},
  });
});

it('calls onPress instead of linking when linkToProfile is false', () => {
  const onPress = jest.fn();
  const r = render({onPress, linkToProfile: false});

  expect(r.root.findAllByProps({testID: 'profile-link'})).toHaveLength(0);

  act(() => {
    chooseButton(r).props.onPress();
  });
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('labels the choice button with the reciter name', () => {
  const r = render({linkToProfile: false});
  const button = chooseButton(r);
  expect(button.props.accessibilityRole).toBe('button');
  expect(button.props.accessibilityLabel).toBe('Test Reciter');
});

// @ai-start
it('links to the profile in the tab it is shown in', () => {
  const r = render({profilePathname: '/(tabs)/(b.search)/reciter/[id]'});
  const link = r.root.findByProps({testID: 'profile-link'});
  expect(link.props.href).toEqual({
    pathname: '/(tabs)/(b.search)/reciter/[id]',
    params: {id: 'reciter-1'},
  });
});
// @ai-end

// @ai-start
it('shows the play badge only when asked', () => {
  const badges = (r: ReactTestRenderer) =>
    r.root.findAll(
      n => (n.type as unknown) === 'View' && n.props.testID === 'play-badge',
    );
  expect(badges(render({linkToProfile: false}))).toHaveLength(0);
  act(() => mounted?.unmount());
  expect(
    badges(render({linkToProfile: false, showPlayBadge: true})),
  ).toHaveLength(1);
});

it('uses the iPad caption sizes with tabletText', () => {
  const sizes = (r: ReactTestRenderer) =>
    r.root
      .findAll(n => (n.type as unknown) === 'Text')
      .map(n => StyleSheet.flatten(n.props.style).fontSize);
  const phone = sizes(render());
  act(() => mounted?.unmount());
  expect(sizes(render({tabletText: true}))).toEqual([14, 12]);
  expect(phone).not.toEqual([14, 12]);
});
// @ai-end
