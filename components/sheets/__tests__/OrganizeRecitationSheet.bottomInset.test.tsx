/**
 * The Edit details sheet of an upload (OrganizeRecitationSheet) turns the
 * sheet's own bottom safe-area padding off and runs to the screen's bottom
 * edge on phones. Its scroll used to end only 40pt under Delete, so the home
 * indicator or a 3-button navigation bar (48dp) covered the end of it. The
 * scroll now ends the inset higher on phones; the iPad card pads its own
 * bottom; an open keyboard still sets the space by its height.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Keyboard, ScrollView, StyleSheet} from 'react-native';
import type {UploadedRecitation} from '@/types/uploads';

const mockInsets = {top: 47, bottom: 34, left: 0, right: 0};
const mockDevice = {isTablet: false};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
  // @ai: useSheetBottomPadding reads the insets from the context.
  SafeAreaInsetsContext: jest.requireActual('react').createContext(mockInsets),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: mockDevice.isTablet}),
}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({children}: {children?: React.ReactNode}) =>
      ReactActual.createElement(View, null, children),
  };
});
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hide: jest.fn()},
}));
jest.mock('@/components/sheets/SheetGestures', () => ({
  SheetScrollView: jest.requireActual('react-native').ScrollView,
  SheetFooter: jest.requireActual('react-native').View,
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
      },
    },
  }),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: () => ({
    updateTags: jest.fn(),
    deleteRecitation: jest.fn(),
    customReciters: [],
    createCustomReciter: jest.fn(),
  }),
}));
jest.mock('@/services/dataService', () => ({
  searchSurahs: () => [],
  getSurahById: () => undefined,
  getReciterName: () => null,
}));
jest.mock('@/utils/search/catalog', () => ({rankReciters: () => []}));

import {OrganizeRecitationSheet} from '../OrganizeRecitationSheet';
import {moderateScale} from '@/utils/scale';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const recitation: UploadedRecitation = {
  id: 'upload-1',
  filePath: 'upload-1.mp3',
  originalFilename: 'recording.mp3',
  duration: 125,
  dateAdded: 0,
  type: null,
  surahNumber: null,
  startVerse: null,
  endVerse: null,
  title: null,
  category: null,
  reciterId: null,
  customReciterId: null,
  isPersonal: false,
  rewayah: null,
  style: null,
  recordingType: null,
};

const END_SPACE = moderateScale(40);

let renderer: TestRenderer.ReactTestRenderer | null = null;

function open() {
  act(() => {
    renderer = TestRenderer.create(
      <OrganizeRecitationSheet
        sheetId="organize-recitation"
        payload={{recitation}}
      />,
    );
  });
}

/** Space under the last field at the end of the scroll. */
function scrollEndPadding(): number {
  if (!renderer) throw new Error('nothing rendered');
  const scroll = renderer.root.find(n => (n.type as unknown) === ScrollView);
  return StyleSheet.flatten(scroll.props.contentContainerStyle)
    .paddingBottom as number;
}

beforeEach(() => {
  mockDevice.isTablet = false;
  mockInsets.bottom = 34;
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('phone with a home indicator: the scroll ends the inset above the 40pt space', () => {
  open();
  expect(scrollEndPadding()).toBe(END_SPACE + 34);
});

it('Android 3-button navigation: Delete clears the 48dp bar', () => {
  mockInsets.bottom = 48;
  open();
  expect(scrollEndPadding()).toBe(END_SPACE + 48);
});

it('iPad: the card pads its own bottom, so the scroll keeps 40pt', () => {
  mockDevice.isTablet = true;
  open();
  expect(scrollEndPadding()).toBe(END_SPACE);
});

it('an open keyboard sets the space by its height, as before', () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const spy = jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((event, listener) => {
      listeners.set(event, listener as (event: unknown) => void);
      return {remove: jest.fn()} as never;
    });
  try {
    open();
    const show =
      listeners.get('keyboardWillShow') ?? listeners.get('keyboardDidShow');
    if (!show) throw new Error('no keyboard listener');
    act(() => show({endCoordinates: {height: 336}}));
    expect(scrollEndPadding()).toBe(336);
  } finally {
    spy.mockRestore();
  }
});
