// @ai-generated
import React, {act} from 'react';
import {Text} from 'react-native';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import {RECITERS, Reciter, Rewayat} from '@/data/reciterData';
import {useReciterStore} from '@/store/reciterStore';
import {useSettings} from '@/hooks/useSettings';
import DefaultReciterScreen from '@/app/(tabs)/(d.settings)/default-reciter';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#06151C', background: '#f4f3ec'},
      fonts: {regular: 'R', semiBold: 'S', bold: 'B'},
      isDarkMode: false,
    },
  }),
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/SearchInput', () => {
  const {TextInput} = jest.requireActual('react-native');
  return {
    SearchInput: (props: {
      value: string;
      onChangeText: (s: string) => void;
      placeholder: string;
    }) => (
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
      />
    ),
  };
});
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('@/utils/haptics', () => ({lightHaptics: jest.fn()}));
jest.mock('expo-router', () => ({useFocusEffect: () => undefined}));
jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({playback: {state: 'paused'}})},
}));
jest.mock('react-native-reanimated', () => {
  const {View} = jest.requireActual('react-native');
  const anim = {duration: () => anim};
  return {
    __esModule: true,
    default: {View},
    FadeInDown: anim,
    FadeOutDown: anim,
  };
});

const ALL = Array.from({length: 114}, (_, i) => i + 1);
const HAFS = "Hafs A'n Assem";

function rewayah(reciterId: string, style: string): Rewayat {
  const entry = {
    id: `${reciterId}-${style}`,
    reciter_id: reciterId,
    name: HAFS,
    style,
    surah_list: ALL,
  };
  return entry as unknown as Rewayat;
}

function reciter(id: string, name: string, styles: string[]): Reciter {
  return {
    id,
    name,
    date: null,
    image_url: null,
    rewayat: styles.map(style => rewayah(id, style)),
  };
}

beforeEach(() => {
  RECITERS.splice(
    0,
    RECITERS.length,
    reciter('mishary', 'Mishary Alafasi', ['murattal']),
    reciter('minshawi', 'Al-Minshawi', ['murattal', 'mojawwad']),
  );
  useReciterStore.getState().setDefaultReciter(RECITERS[0]);
  useReciterStore.getState().catalogLoaded();
});

let mounted: ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    mounted?.unmount();
    jest.runOnlyPendingTimers();
  });
  mounted = null;
  jest.useRealTimers();
});

function render(): ReactTestRenderer {
  jest.useFakeTimers();
  let renderer: ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(<DefaultReciterScreen />);
    jest.runOnlyPendingTimers();
  });
  if (!renderer) throw new Error('Screen did not render');
  mounted = renderer;
  return renderer;
}

function texts(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAll(
    n => n.type === Text && n.props.children === label,
  );
}

/** Presses the nearest pressable around the first text with this label. */
function press(renderer: ReactTestRenderer, label: string) {
  let node: ReactTestInstance | null = texts(renderer, label)[0] ?? null;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`Nothing pressable labelled ${label}`);
  const target = node;
  act(() => {
    target.props.onPress();
  });
}

it('shows the default reciter and lists every full-Quran reciter', () => {
  const screen = render();
  expect(texts(screen, 'Mishary Alafasi').length).toBeGreaterThan(0);
  expect(texts(screen, 'Al-Minshawi')).toHaveLength(1);
});

it('sets a new default from the list and can undo it', () => {
  const screen = render();
  press(screen, 'Al-Minshawi');
  expect(useReciterStore.getState().defaultReciter.id).toBe('minshawi');
  expect(texts(screen, 'Al-Minshawi is your default reciter')).toHaveLength(1);

  // The hero now offers the reciter's recitations.
  press(screen, 'Mojawwad');
  expect(useSettings.getState().reciterPreferences.minshawi).toBe(
    'minshawi-mojawwad',
  );

  press(screen, 'Undo');
  expect(useReciterStore.getState().defaultReciter.id).toBe('mishary');
});

it('switches between playing the default and asking each time', () => {
  const screen = render();
  press(screen, 'Ask each time');
  expect(useSettings.getState().askEveryTime).toBe(true);
  press(screen, 'Play my default');
  expect(useSettings.getState().askEveryTime).toBe(false);
  expect(useSettings.getState().defaultReciterSelection).toBe('useDefault');
});
