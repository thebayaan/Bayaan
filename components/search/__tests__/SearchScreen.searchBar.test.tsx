// @ai-generated
/**
 * On iOS 26 the Search tab's native bar is unmounted on every blur and a new,
 * empty one is mounted on the next focus, while the screen's `query` stays.
 * Coming back from a result showed an empty field over the old results.
 * The screen lives in app/, so its test lives here.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

type BarProps = {
  ref?: React.Ref<{
    setText: (text: string) => void;
    focus: () => void;
    blur: () => void;
  }>;
  onChangeText: (e: {nativeEvent: {text: string}}) => void;
  onFocus: () => void;
};

const mockBar: {
  props: BarProps | null;
  mounts: number;
  setText: jest.Mock;
  blur: jest.Mock;
  /** False stands for a bar whose handle never arrives. */
  attachHandle: boolean;
} = {
  props: null,
  mounts: 0,
  setText: jest.fn(),
  blur: jest.fn(),
  attachHandle: true,
};
const mockFocus: {effect: (() => () => void) | null} = {effect: null};
const mockSearchView: {
  props: {
    query: string;
    isSearchActive: boolean;
    onDismissKeyboard?: () => void;
  } | null;
} = {props: null};

jest.mock('expo-router', () => {
  const MockReact = jest.requireActual('react');
  function SearchBar(props: BarProps) {
    mockBar.props = props;
    MockReact.useEffect(() => {
      mockBar.mounts += 1;
    }, []);
    MockReact.useImperativeHandle(
      mockBar.attachHandle ? props.ref : null,
      () => ({
        setText: mockBar.setText,
        focus: jest.fn(),
        blur: mockBar.blur,
      }),
      [],
    );
    return null;
  }
  return {
    Stack: {SearchBar},
    useFocusEffect: (effect: () => () => void) => {
      mockFocus.effect = effect;
    },
    useIsFocused: () => true,
  };
});
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: true}));
jest.mock('@/components/search/SearchView', () => ({
  SearchView: (props: {query: string; isSearchActive: boolean}) => {
    mockSearchView.props = props;
    return null;
  },
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#000000', background: '#ffffff'}},
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

import SearchScreen from '@/app/(tabs)/(b.search)/index';

let blur: (() => void) | null = null;

function focus() {
  act(() => {
    blur = mockFocus.effect!();
  });
  // The text goes back on the frame after the bar is mounted.
  act(() => {
    jest.runAllTimers();
  });
}

function leave() {
  act(() => {
    blur!();
  });
}

function type(text: string) {
  act(() => {
    mockBar.props!.onChangeText({nativeEvent: {text}});
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockBar.props = null;
  mockBar.mounts = 0;
  mockBar.setText.mockClear();
  mockBar.blur.mockClear();
  mockBar.attachHandle = true;
  mockSearchView.props = null;
  act(() => {
    TestRenderer.create(<SearchScreen />);
  });
});

afterEach(() => {
  jest.useRealTimers();
});

it('puts the query back into the bar mounted on the next focus', () => {
  focus();
  type('mishary');
  leave();
  focus();

  expect(mockBar.mounts).toBe(2);
  expect(mockBar.setText).toHaveBeenCalledTimes(1);
  expect(mockBar.setText).toHaveBeenCalledWith('mishary');
  expect(mockSearchView.props!.query).toBe('mishary');
});

it('leaves an empty bar alone', () => {
  focus();
  leave();
  focus();

  expect(mockBar.setText).not.toHaveBeenCalled();
  expect(mockSearchView.props!.query).toBe('');
});

it('drops the query when the new bar cannot take the text', () => {
  focus();
  type('mishary');
  leave();
  mockBar.attachHandle = false;
  focus();

  expect(mockBar.setText).not.toHaveBeenCalled();
  expect(mockSearchView.props!.query).toBe('');
});

it('is back on Explore after leaving with the cursor in an empty field', () => {
  focus();
  act(() => {
    mockBar.props!.onFocus();
  });
  expect(mockSearchView.props!.isSearchActive).toBe(true);

  leave();
  focus();

  expect(mockSearchView.props!.isSearchActive).toBe(false);
});

// Keyboard.dismiss() only reaches React Native text inputs, so the results
// asked the screen to blur the native bar: dragging them left the keyboard up.
it('blurs the native bar when the results dismiss the keyboard', () => {
  focus();
  type('mishary');
  act(() => {
    mockSearchView.props!.onDismissKeyboard!();
  });

  expect(mockBar.blur).toHaveBeenCalledTimes(1);
});

it('leaves an empty bar focused, so recent searches stay up', () => {
  focus();
  act(() => {
    mockSearchView.props!.onDismissKeyboard!();
  });

  expect(mockBar.blur).not.toHaveBeenCalled();
});
