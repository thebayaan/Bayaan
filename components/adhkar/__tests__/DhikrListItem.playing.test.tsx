import React from 'react';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import type {Dhikr} from '@/types/adhkar';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      fonts: {regular: 'r', medium: 'm', semiBold: 's'},
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        card: '#ffffff',
        background: '#ffffff',
      },
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

jest.mock('@/i18n/format', () => ({
  localizeDigits: (n: number) => String(n),
}));

jest.mock('@/store/adhkarSettingsStore', () => ({
  useAdhkarSettingsStore: (
    selector: (s: {showTranslation: boolean}) => unknown,
  ) => selector({showTranslation: false}),
}));

jest.mock('react-native-reanimated', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View: MockView},
    cancelAnimation: jest.fn(),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    useSharedValue: (v: number) => ({value: v}),
    withDelay: (_d: number, v: number) => v,
    withRepeat: (v: number) => v,
    withTiming: (v: number) => v,
  };
});

jest.mock('../AdhkarArabicText', () => ({AdhkarArabicText: () => null}));
jest.mock('../AdhkarLatinText', () => ({AdhkarLatinText: () => null}));

const dhikr: Dhikr = {
  id: 'a',
  categoryId: 'c',
  arabic: 'سُبْحَانَ اللَّهِ',
  translation: null,
  transliteration: null,
  instruction: null,
  repeatCount: 1,
  audioFile: 'a.mp3',
  sortOrder: 1,
};

function hasBars(renderer: ReactTestRenderer): boolean {
  return (
    renderer.root.findAll(n => n.props.testID === 'dhikr-playing-bars').length >
    0
  );
}

it('shows bars only on the current card', () => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<DhikrListItem dhikr={dhikr} index={0} />);
  });
  if (!renderer) throw new Error('not rendered');
  expect(hasBars(renderer)).toBe(false);
  act(() => {
    renderer?.update(
      <DhikrListItem dhikr={dhikr} index={0} isCurrent isPlaying />,
    );
  });
  expect(hasBars(renderer)).toBe(true);
});

it('mixes the current tint over the card so it stays opaque', () => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <DhikrListItem dhikr={dhikr} index={0} isCurrent />,
    );
  });
  if (!renderer) throw new Error('not rendered');
  const card = renderer.root.find(
    n =>
      (n.type as unknown) === 'View' && n.props.accessibilityRole === 'button',
  );
  const flat = StyleSheet.flatten(card.props.style);
  // #111111 at 6% over #ffffff, with no alpha channel.
  expect(flat.backgroundColor).toBe('rgb(241, 241, 241)');
});

it('bars grow from the baseline', () => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <DhikrListItem dhikr={dhikr} index={0} isCurrent isPlaying />,
    );
  });
  if (!renderer) throw new Error('not rendered');
  const bars = renderer.root.find(n => n.props.testID === 'dhikr-playing-bars');
  const origins = bars
    .findAll(n => (n.type as unknown) === 'View' && n !== bars)
    .map(n => StyleSheet.flatten(n.props.style).transformOrigin)
    .filter(Boolean);
  expect(origins).toHaveLength(3);
  expect(origins.every(o => o === 'bottom')).toBe(true);
});
