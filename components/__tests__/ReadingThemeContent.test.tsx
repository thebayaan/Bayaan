// @ai-generated
// Reading Theme lists the themes of the mode the app is drawn in, and a tap
// saves the theme for that mode. It used to ask the device for the mode, which
// could disagree with the app (in System mode it read as light inside a dark
// app): the light themes were listed and a tap changed a setting the dark
// mushaf does not use. In Jest the device always reads as light, so a dark app
// here is exactly that disagreement.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {
  DARK_READING_THEMES,
  LIGHT_READING_THEMES,
} from '@/constants/readingThemes';

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Group: () => null,
  Skia: {},
  BlendMode: {},
  TextDirection: {},
  TextAlign: {},
}));
// The preview draws with Skia once the mushaf fonts are loaded; they never
// are here, so the screen shows its placeholder.
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: false, quranCommonTypeface: null},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {initialized: false, rewayah: 'hafs'},
}));
jest.mock('@/services/mushaf/RewayahBasmalaService', () => ({
  rewayahBasmalaService: {getText: () => ''},
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({useMushafFontMgr: () => null}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));

type SegmentProps = {selectedIndex: number; onChange: (index: number) => void};
let mockSegment: SegmentProps | null = null;
jest.mock('@/components/native/NativeSegmentedControl', () => ({
  NativeSegmentedControl: (props: SegmentProps) => {
    mockSegment = props;
    return null;
  },
}));

import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useThemeStore} from '@/store/themeStore';
import {createTheme, type ThemeMode} from '@/utils/themeUtils';
import {ReadingThemeContent} from '../ReadingThemeContent';

// Segment order on the screen: System | Light | Dark.
const SYSTEM = 0;
const LIGHT = 1;

/** The app in `mode`, drawn dark or light (System: whatever the device uses). */
function appLooks(mode: ThemeMode, look: 'light' | 'dark'): void {
  useThemeStore.setState({themeMode: mode, theme: createTheme(look, 'Blue')});
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render() {
  let created!: TestRenderer.ReactTestRenderer;
  act(() => {
    created = TestRenderer.create(<ReadingThemeContent onBack={jest.fn()} />);
  });
  renderer = created;
  return created;
}

const chips = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll(
    n =>
      n.props.accessibilityRole === 'radio' &&
      typeof n.props.onPress === 'function' &&
      typeof n.type !== 'string',
  );

const chipNames = (r: TestRenderer.ReactTestRenderer) =>
  chips(r).map(chip => chip.props.accessibilityLabel);

const segment = (): SegmentProps => {
  if (!mockSegment) throw new Error('segmented control not rendered');
  return mockSegment;
};

beforeEach(() => {
  mockSegment = null;
  useMushafSettingsStore.setState({
    lightThemeId: 'default',
    darkThemeId: 'dark-default',
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('ReadingThemeContent', () => {
  it('lists the dark themes when the app is dark in System mode', () => {
    appLooks('system', 'dark');

    const r = render();

    expect(chipNames(r)).toEqual(DARK_READING_THEMES.map(theme => theme.name));
    expect(segment().selectedIndex).toBe(SYSTEM);
  });

  it('saves a tapped theme for the mode the app is in', () => {
    appLooks('system', 'dark');
    const r = render();

    act(() => chips(r)[2].props.onPress());

    const settings = useMushafSettingsStore.getState();
    expect(settings.darkThemeId).toBe(DARK_READING_THEMES[2].id);
    expect(settings.lightThemeId).toBe('default');
    expect(chips(r)[2].props.accessibilityState).toEqual({checked: true});
  });

  it('lists the light themes when the app is light', () => {
    appLooks('system', 'light');

    const r = render();

    expect(chipNames(r)).toEqual(LIGHT_READING_THEMES.map(theme => theme.name));
  });

  it('pairs the theme by position when the segment changes the look', () => {
    appLooks('system', 'dark');
    useMushafSettingsStore.setState({darkThemeId: DARK_READING_THEMES[2].id});
    const r = render();

    act(() => segment().onChange(LIGHT));

    expect(useThemeStore.getState().themeMode).toBe('light');
    expect(useMushafSettingsStore.getState().lightThemeId).toBe(
      LIGHT_READING_THEMES[2].id,
    );
    expect(chipNames(r)).toEqual(LIGHT_READING_THEMES.map(theme => theme.name));
  });

  it('keeps both saved themes when the segment goes to System', () => {
    appLooks('dark', 'dark');
    useMushafSettingsStore.setState({
      lightThemeId: LIGHT_READING_THEMES[3].id,
      darkThemeId: DARK_READING_THEMES[2].id,
    });
    render();

    act(() => segment().onChange(SYSTEM));

    // The device's scheme is not known until the native side reports it, so
    // nothing is re-paired on the way to System.
    expect(useThemeStore.getState().themeMode).toBe('system');
    const settings = useMushafSettingsStore.getState();
    expect(settings.lightThemeId).toBe(LIGHT_READING_THEMES[3].id);
    expect(settings.darkThemeId).toBe(DARK_READING_THEMES[2].id);
  });
});
