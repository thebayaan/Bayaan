// @ai-generated
/**
 * VoiceOver in the dhikr readers: the native header title fell back to the
 * route name, so VoiceOver read "[superId]/[dhikrId]", and the share button
 * had no label. The readers live in app/, so their test lives here.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

type HeaderOptions = {
  title?: string;
  headerTitle?: () => React.ReactElement;
  headerRight?: () => React.ReactElement;
};
let mockOptions: HeaderOptions = {};
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({back: jest.fn(), push: jest.fn()}),
  useNavigation: () => ({
    setOptions: (o: HeaderOptions) => {
      mockOptions = {...mockOptions, ...o};
    },
  }),
  useFocusEffect: jest.fn(),
}));
jest.mock('expo-router/react-navigation', () => ({useHeaderHeight: () => 0}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#000', textSecondary: '#666', background: '#fff'},
      fonts: {semiBold: 'S', regular: 'R'},
    },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: {current?: number; total?: number}) =>
      o?.total ? `${key}:${o.current}/${o.total}` : key,
  }),
}));
jest.mock('@/hooks/useAdhkar', () => ({
  useAdhkar: () => ({isSaved: () => false, toggleSaved: jest.fn()}),
}));
jest.mock('@/components/adhkar/DhikrReader', () => ({DhikrReader: () => null}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));
jest.mock('@/services/adhkar/AdhkarService', () => ({
  adhkarService: {
    getAdhkarForSuperCategory: jest.fn(async () => null),
    getSaved: jest.fn(async () => []),
    getDhikr: jest.fn(async () => null),
  },
}));
jest.mock('@/store/adhkarSessionStore', () => ({
  useAdhkarSessionStore: (
    select: (s: {
      session: null;
      revealToken: number;
      dispatch: jest.Mock;
    }) => unknown,
  ) => select({session: null, revealToken: 0, dispatch: jest.fn()}),
}));
jest.mock('@/services/adhkar/playback/openPlayingDhikr', () => ({
  setAdhkarFocus: jest.fn(),
  clearAdhkarFocus: jest.fn(),
}));
jest.mock('@/utils/adhkarUtils', () => ({
  getSuperCategoryDisplayTitle: (title: string) => title,
  shortenCategoryTitle: (title: string) => title,
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: true}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('@/utils/shareUtils', () => ({
  dhikrShareUrl: jest.fn(),
  shareUrl: jest.fn(),
}));

async function render(path: string) {
  mockOptions = {};
  const Screen = require(path).default;
  await act(async () => {
    TestRenderer.create(<Screen />);
  });
}

/** Renders a header option and returns the element it draws. */
function renderOption(option: (() => React.ReactElement) | undefined) {
  if (!option) throw new Error('header option not set');
  const draw = option;
  function Host() {
    return draw();
  }
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<Host />);
  });
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root.children[0] as TestRenderer.ReactTestInstance;
}

describe('category reader', () => {
  beforeEach(async () => {
    mockParams = {
      superId: 'morning',
      dhikrId: 'd1',
      categoryShortTitle: 'Morning',
    };
    await render('@/app/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]');
  });

  it('gives the native header its title instead of the route name', () => {
    expect(mockOptions.title).toBe('Morning');
  });

  it('marks the drawn title as one header for VoiceOver', () => {
    const view = renderOption(mockOptions.headerTitle);
    expect(view.props.accessible).toBe(true);
    expect(view.props.accessibilityRole).toBe('header');
    expect(view.findAll(n => n.props.children === 'Morning')).not.toHaveLength(
      0,
    );
  });

  it('labels the share button', () => {
    const button = renderOption(mockOptions.headerRight);
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('common:actions.share');
  });
});

describe('saved reader', () => {
  beforeEach(async () => {
    mockParams = {dhikrId: 'd1'};
    await render('@/app/(tabs)/(a.home)/adhkar/saved/[dhikrId]');
  });

  it('gives the native header its title instead of the route name', () => {
    expect(mockOptions.title).toBe('adhkar.saved');
  });

  it('marks the drawn title as one header for VoiceOver', () => {
    const view = renderOption(mockOptions.headerTitle);
    expect(view.props.accessible).toBe(true);
    expect(view.props.accessibilityRole).toBe('header');
  });
});
