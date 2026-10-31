// @ai-generated
import React from 'react';
import {Alert, Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

let mockThemeMode: 'light' | 'dark' | 'system' = 'light';
const mockSetThemeMode = jest.fn();
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#444444',
        background: '#ffffff',
        border: '#dddddd',
      },
      typography: {
        headingSize: 30,
        subheadingSize: 18,
        bodySize: 16,
        mediumSize: 14,
        smallSize: 12,
        arabicSize: 20,
        captionSize: 10,
      },
    },
    themeMode: mockThemeMode,
    setThemeMode: mockSetThemeMode,
  }),
}));
jest.mock('react-native-reanimated', () => {
  const {View: MockView} = jest.requireActual('react-native');
  const identity = (value: unknown) => value;
  return {
    __esModule: true,
    default: {View: MockView},
    Easing: {
      bezier: () => identity,
      bezierFn: () => identity,
      linear: identity,
    },
    cancelAnimation: jest.fn(),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({value}),
    withRepeat: identity,
    withSpring: identity,
    withTiming: identity,
  };
});
jest.mock('react-native-worklets', () => ({
  runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
}));
jest.mock('@/components/native/NativeSwitch', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    NativeSwitch: (props: {testID?: string}) => (
      <MockView {...props} testID={props.testID} />
    ),
  };
});
jest.mock('@/components/native/NativeSlider', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    NativeSlider: (props: object) => (
      <MockView {...props} testID="size-slider" />
    ),
  };
});
jest.mock('@/components/native/NativeSegmentedControl', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    NativeSegmentedControl: (props: object) => <MockView {...props} />,
  };
});
jest.mock('../QuranText', () => ({QuranText: () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useRewayahWords', () => ({
  useRewayahWords: () => ({words: [], status: 'ready'}),
}));
jest.mock('@/store/tajweedStore', () => ({
  useTajweedStore: (selector: (s: object) => unknown) =>
    selector({indexedTajweedData: null}),
}));
jest.mock('@/components/sheets/rewayahSelection', () => ({
  chooseMushafRewayah: jest.fn(() => Promise.resolve({kind: 'switched'})),
  chooseMushafRenderer: jest.fn(() => Promise.resolve({kind: 'switched'})),
}));
jest.mock('@/components/sheets/sheetControl', () => ({
  hideSheet: jest.fn(),
}));
jest.mock('@/components/native/nativeSheets', () => ({
  setNativeSheetDetents: jest.fn(),
}));
let mockReflections = false;
jest.mock('@/config/branding', () => {
  const actual = jest.requireActual('@/config/branding');
  const base = actual.default ?? actual;
  // Live getters (a spread would copy them once), so a test can turn the
  // reflections slot on.
  const mocked = Object.assign({}, base);
  Object.defineProperties(mocked, {
    communityReflectionsProvider: {
      get: () => (mockReflections ? {} : base.communityReflectionsProvider),
    },
    ayahCommunityReflectionsComponent: {
      get: () =>
        mockReflections ? () => null : base.ayahCommunityReflectionsComponent,
    },
  });
  return {__esModule: true, default: mocked};
});

import {MushafOptionsContent} from '../MushafOptionsContent';
import {
  getActualFontSize,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {
  DARK_READING_THEMES,
  LIGHT_READING_THEMES,
} from '@/constants/readingThemes';
import {
  chooseMushafRenderer,
  chooseMushafRewayah,
} from '@/components/sheets/rewayahSelection';
import {hideSheet} from '@/components/sheets/sheetControl';
import {setNativeSheetDetents} from '@/components/native/nativeSheets';
import {NativeSheetLevelContext} from '@/components/native/nativeSheetContext';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const initial = useMushafSettingsStore.getState();
let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(element: React.JSX.Element): TestRenderer.ReactTestRenderer {
  act(() => {
    renderer = TestRenderer.create(element);
  });
  if (!renderer) throw new Error('not rendered');
  return renderer;
}

/** The innermost element with `testID` that handles `prop`. */
function byId(
  r: TestRenderer.ReactTestRenderer,
  testID: string,
  prop = 'onPress',
): TestRenderer.ReactTestInstance {
  const all = r.root.findAll(
    node =>
      node.props.testID === testID && typeof node.props[prop] === 'function',
  );
  if (all.length === 0) throw new Error(`no ${testID} with ${prop}`);
  return all[all.length - 1];
}

function has(r: TestRenderer.ReactTestRenderer, testID: string): boolean {
  return r.root.findAll(node => node.props.testID === testID).length > 0;
}

function press(r: TestRenderer.ReactTestRenderer, testID: string): void {
  act(() => {
    byId(r, testID).props.onPress();
  });
}

function flip(r: TestRenderer.ReactTestRenderer, testID: string): void {
  const node = byId(r, testID, 'onValueChange');
  act(() => {
    node.props.onValueChange(!node.props.value);
  });
}

function texts(r: TestRenderer.ReactTestRenderer): string[] {
  return r.root
    .findAll(node => (node.type as unknown) === Text)
    .map(node => [node.props.children].flat().join(''));
}

const state = () => useMushafSettingsStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  mockThemeMode = 'light';
  mockReflections = false;
  useMushafSettingsStore.setState(
    {
      ...initial,
      viewMode: 'mushaf',
      scrollDirection: 'horizontal',
      pageLayout: 'fullscreen',
      rewayah: 'hafs',
      mushafRenderer: 'dk_v2',
      rewayahFallbackFrom: null,
      showTajweed: false,
      showAllahNameHighlight: false,
      showThemes: false,
      showTranslation: false,
      showTransliteration: false,
      showWBW: false,
      wbwShowTranslation: false,
      wbwShowTransliteration: false,
      showRewayahDiffs: false,
      arabicTextWeight: 'normal',
      lightThemeId: 'default',
      darkThemeId: 'dark-default',
    },
    true,
  );
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('settings written through the Reading sheet', () => {
  it('View and Layout write viewMode, scrollDirection and pageLayout', () => {
    const r = render(<MushafOptionsContent context="mushaf" />);
    press(r, 'mushaf-options-layout-book');
    expect(state()).toMatchObject({
      scrollDirection: 'horizontal',
      pageLayout: 'book',
    });
    press(r, 'mushaf-options-layout-scroll');
    expect(state().scrollDirection).toBe('vertical');
    press(r, 'mushaf-options-layout-single');
    expect(state()).toMatchObject({
      scrollDirection: 'horizontal',
      pageLayout: 'fullscreen',
    });

    press(r, 'mushaf-options-view-list');
    expect(state().viewMode).toBe('list');
    // The List view's own layouts replace the Mushaf ones.
    expect(has(r, 'mushaf-options-layout-book')).toBe(false);
    press(r, 'mushaf-options-layout-continuous');
    expect(state().scrollDirection).toBe('vertical');
    press(r, 'mushaf-options-layout-pages');
    expect(state().scrollDirection).toBe('horizontal');
    press(r, 'mushaf-options-view-mushaf');
    expect(state().viewMode).toBe('mushaf');
  });

  it('marks the tiles as radios with their selected state', () => {
    const r = render(<MushafOptionsContent />);
    const single = byId(r, 'mushaf-options-layout-single');
    expect(single.props.accessibilityRole).toBe('radio');
    expect(single.props.accessibilityState).toMatchObject({checked: true});
    expect(
      byId(r, 'mushaf-options-layout-book').props.accessibilityState,
    ).toMatchObject({checked: false});
  });

  it('Theme writes the current mode theme id and cycles the app mode', () => {
    const r = render(<MushafOptionsContent />);
    const theme = LIGHT_READING_THEMES[3];
    press(r, `mushaf-options-theme-${theme.id}`);
    expect(state().lightThemeId).toBe(theme.id);
    expect(state().darkThemeId).toBe('dark-default');

    press(r, 'mushaf-options-theme-mode');
    expect(mockSetThemeMode).toHaveBeenCalledWith('dark');
    // The dark theme at the same position is picked.
    expect(state().darkThemeId).toBe(DARK_READING_THEMES[3].id);
  });

  it('Text writes the weight and, in List view, each text size', () => {
    useMushafSettingsStore.setState({viewMode: 'list'});
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-text');
    press(r, 'mushaf-options-weight-bold');
    expect(state().arabicTextWeight).toBe('bold');

    const slider = () => byId(r, 'size-slider', 'onValueChange');
    act(() => slider().props.onValueChange(7));
    expect(state().arabicFontSize).toBe(getActualFontSize(7));

    const segments = byId(r, 'mushaf-options-size-target', 'onChange');
    act(() => segments.props.onChange(1));
    act(() => slider().props.onValueChange(3));
    expect(state().translationFontSize).toBe(getActualFontSize(3));
    expect(state().arabicFontSize).toBe(getActualFontSize(7));

    act(() =>
      byId(r, 'mushaf-options-size-target', 'onChange').props.onChange(2),
    );
    act(() => slider().props.onValueChange(9));
    expect(state().transliterationFontSize).toBe(getActualFontSize(9));
  });

  it('the size control is adjustable', () => {
    useMushafSettingsStore.setState({
      viewMode: 'list',
      arabicFontSize: getActualFontSize(4),
    });
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-text');
    const size = byId(r, 'mushaf-options-size', 'onAccessibilityAction');
    expect(size.props.accessibilityRole).toBe('adjustable');
    act(() =>
      size.props.onAccessibilityAction({
        nativeEvent: {actionName: 'increment'},
      }),
    );
    expect(state().arabicFontSize).toBe(getActualFontSize(5));
  });

  it('Mushaf view keeps the printed size: no size control', () => {
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-text');
    expect(has(r, 'mushaf-options-size')).toBe(false);
    expect(texts(r)).toContain(
      'Mushaf pages keep their printed size. Switch to List to resize.',
    );
  });

  it('Under each verse chips write showTranslation, showTransliteration and showWBW', () => {
    useMushafSettingsStore.setState({viewMode: 'list'});
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-verse');
    const chip = byId(r, 'mushaf-options-verse-translation');
    expect(chip.props.accessibilityRole).toBe('checkbox');
    press(r, 'mushaf-options-verse-translation');
    press(r, 'mushaf-options-verse-transliteration');
    press(r, 'mushaf-options-verse-wordByWord');
    expect(state()).toMatchObject({
      showTranslation: true,
      showTransliteration: true,
      showWBW: true,
    });
    expect(texts(r)).toContain('Translation, Transliteration, Word by word');
  });

  it('hides Under each verse in the Mushaf view', () => {
    const r = render(<MushafOptionsContent />);
    expect(has(r, 'mushaf-options-card-verse')).toBe(false);
  });

  it('Highlights writes tajweed, Names of Allah with its color, and themes', () => {
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-highlights');
    expect(has(r, 'mushaf-options-allah-rose')).toBe(false);
    flip(r, 'mushaf-options-tajweed');
    flip(r, 'mushaf-options-allah');
    press(r, 'mushaf-options-allah-rose');
    flip(r, 'mushaf-options-themes');
    expect(state()).toMatchObject({
      showTajweed: true,
      showAllahNameHighlight: true,
      allahNameHighlightColor: 'rose',
      showThemes: true,
    });
    expect(texts(r)).toContain('Tajweed, Names of Allah, Thematic');
  });

  it('opens the tajweed legend from What the colors mean', () => {
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-highlights');
    expect(texts(r)).not.toContain('Necessary madd');
    press(r, 'mushaf-options-tajweed-legend');
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Necessary madd', 'Ghunnah', 'Silent']),
    );
  });

  it('Word details writes wbwShowTranslation and wbwShowTransliteration', () => {
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-words');
    flip(r, 'mushaf-options-wbw-meaning');
    flip(r, 'mushaf-options-wbw-translit');
    expect(state()).toMatchObject({
      wbwShowTranslation: true,
      wbwShowTransliteration: true,
    });
  });

  it('Mushaf text chooses the script and rewayah through the shared handlers', () => {
    const r = render(<MushafOptionsContent />);
    expect(texts(r)).toContain('Madani 1421 · Hafs');
    press(r, 'mushaf-options-mushaf-text');
    press(r, 'mushaf-options-script-dk_v1');
    expect(chooseMushafRenderer).toHaveBeenCalledWith('dk_v1');
    press(r, 'mushaf-options-rewayah-warsh');
    expect(chooseMushafRewayah).toHaveBeenCalledWith('warsh');
    press(r, 'mushaf-options-back');
  });
});

describe('the accordion', () => {
  it('keeps one card open and reports expanded state', () => {
    const r = render(<MushafOptionsContent />);
    const expanded = (id: string) =>
      byId(r, id).props.accessibilityState.expanded;
    press(r, 'mushaf-options-card-text');
    expect(expanded('mushaf-options-card-text')).toBe(true);
    press(r, 'mushaf-options-card-highlights');
    expect(expanded('mushaf-options-card-text')).toBe(false);
    expect(expanded('mushaf-options-card-highlights')).toBe(true);
    press(r, 'mushaf-options-card-highlights');
    expect(expanded('mushaf-options-card-highlights')).toBe(false);
  });

  it('grows a native sheet to large while a card is open', () => {
    const r = render(
      <NativeSheetLevelContext.Provider
        value={{id: 'mushaf-layout', key: 7, fit: false, fitted: false}}>
        <MushafOptionsContent />
      </NativeSheetLevelContext.Provider>,
    );
    expect(setNativeSheetDetents).toHaveBeenLastCalledWith(7, null);
    press(r, 'mushaf-options-card-words');
    expect(setNativeSheetDetents).toHaveBeenLastCalledWith(7, ['large']);
    press(r, 'mushaf-options-card-text');
    expect(setNativeSheetDetents).toHaveBeenLastCalledWith(7, ['large']);
    press(r, 'mushaf-options-card-text');
    expect(setNativeSheetDetents).toHaveBeenLastCalledWith(7, null);
    press(r, 'mushaf-options-mushaf-text');
    expect(setNativeSheetDetents).toHaveBeenLastCalledWith(7, ['large']);
  });

  it('snaps the React Native sheet up when a card opens', () => {
    const onGrow = jest.fn();
    const r = render(<MushafOptionsContent onGrow={onGrow} />);
    expect(onGrow).not.toHaveBeenCalled();
    press(r, 'mushaf-options-card-highlights');
    expect(onGrow).toHaveBeenCalledTimes(1);
  });
});

describe('closing', () => {
  it('hides the sheet from the close button', () => {
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-close');
    expect(hideSheet).toHaveBeenCalledWith('mushaf-layout');
  });

  it('closes the popover through onClose', () => {
    const onClose = jest.fn();
    const r = render(<MushafOptionsContent onClose={onClose} />);
    press(r, 'mushaf-options-close');
    expect(onClose).toHaveBeenCalled();
    expect(hideSheet).not.toHaveBeenCalled();
  });
});

describe('special cases', () => {
  it('shows the failed-rewayah banner with Try again and Keep Hafs', async () => {
    useMushafSettingsStore.setState({rewayahFallbackFrom: 'warsh'});
    const r = render(<MushafOptionsContent />);
    expect(texts(r)).toContain("Couldn't load Warsh");
    await act(async () => {
      byId(r, 'mushaf-options-fallback-retry').props.onPress();
    });
    expect(chooseMushafRewayah).toHaveBeenLastCalledWith('warsh');
  });

  it('keeps Hafs from the banner', async () => {
    useMushafSettingsStore.setState({rewayahFallbackFrom: 'warsh'});
    const r = render(<MushafOptionsContent />);
    await act(async () => {
      byId(r, 'mushaf-options-fallback-keep').props.onPress();
    });
    expect(chooseMushafRewayah).toHaveBeenLastCalledWith('hafs');
  });

  it('shows no banner when the rewayah loaded', () => {
    const r = render(<MushafOptionsContent />);
    expect(has(r, 'mushaf-options-fallback-retry')).toBe(false);
  });

  it('greys tajweed and IndoPak out for another rewayah, and offers differences', () => {
    useMushafSettingsStore.setState({rewayah: 'warsh', showTajweed: true});
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-highlights');
    const tajweed = byId(r, 'mushaf-options-tajweed', 'onValueChange');
    expect(tajweed.props.disabled).toBe(true);
    expect(tajweed.props.value).toBe(false);
    expect(texts(r)).toContain('Hafs only. Not shown for Warsh.');
    // The saved preference is kept for when Hafs is back.
    expect(state().showTajweed).toBe(true);

    press(r, 'mushaf-options-mushaf-text');
    const indopak = byId(r, 'mushaf-options-script-dk_indopak');
    expect(indopak.props.disabled).toBe(true);
    expect(indopak.props.accessibilityState).toMatchObject({disabled: true});
    flip(r, 'mushaf-options-differences');
    expect(state().showRewayahDiffs).toBe(true);
    expect(texts(r)).toEqual(expect.arrayContaining(['Word variant']));
  });

  it('shows no differences switch for Hafs', () => {
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-mushaf-text');
    expect(has(r, 'mushaf-options-differences')).toBe(false);
    expect(byId(r, 'mushaf-options-script-dk_indopak').props.disabled).toBe(
      false,
    );
  });

  it('locks the rewayah to Hafs under Mushaf 1440 and labels tajweed Preview', () => {
    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-highlights');
    expect(texts(r)).toContain('Preview in Mushaf 1440');
    press(r, 'mushaf-options-mushaf-text');
    expect(texts(r)).toContain('Mushaf 1440 is in beta and shows Hafs only.');
    const warsh = byId(r, 'mushaf-options-rewayah-warsh');
    expect(warsh.props.disabled).toBe(true);
    act(() => warsh.props.onPress());
    expect(chooseMushafRewayah).not.toHaveBeenCalled();
  });

  it('keeps the Mushaf 1440 beta alert', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-mushaf-text');
    await act(async () => {
      byId(r, 'mushaf-options-script-qcf_v2').props.onPress();
    });
    expect(chooseMushafRenderer).toHaveBeenCalledWith('qcf_v2');
    expect(alert).toHaveBeenCalledWith('Mushaf 1440 Beta', expect.any(String));
    alert.mockRestore();
  });

  it('hides View and Layout from the player and starts at Theme', () => {
    const r = render(<MushafOptionsContent context="player" />);
    expect(has(r, 'mushaf-options-view-mushaf')).toBe(false);
    expect(has(r, 'mushaf-options-layout-single')).toBe(false);
    const headers = texts(r);
    expect(headers).not.toContain('View');
    expect(headers).not.toContain('Layout');
    // Theme is the first section under the title.
    expect(headers.indexOf('Theme')).toBe(headers.indexOf('Reading') + 1);
    // The player reads verse by verse: List view's text options apply.
    expect(has(r, 'mushaf-options-card-verse')).toBe(true);
    press(r, 'mushaf-options-card-text');
    expect(has(r, 'mushaf-options-size')).toBe(true);
  });

  it('hides community reflections under Bayaan branding', () => {
    const actual = jest.requireActual('@/config/branding');
    const bayaan = actual.default ?? actual;
    expect(bayaan.communityReflectionsProvider ?? null).toBeNull();
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-highlights');
    expect(has(r, 'mushaf-options-reflections')).toBe(false);
  });

  it('shows community reflections in an app version that has them', () => {
    mockReflections = true;
    const r = render(<MushafOptionsContent />);
    press(r, 'mushaf-options-card-highlights');
    flip(r, 'mushaf-options-reflections');
    expect(state().showCommunityReflections).toBe(
      !initial.showCommunityReflections,
    );
  });
});

it('renders without a native sheet or a store change', () => {
  const r = render(
    <View>
      <MushafOptionsContent />
    </View>,
  );
  expect(texts(r)).toContain('Reading');
});
