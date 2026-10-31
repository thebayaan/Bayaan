// @ai-generated
import React from 'react';
import {View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {SheetProps} from 'react-native-actions-sheet';

let mockIsTablet = false;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: mockIsTablet}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', background: '#ffffff'}},
  }),
}));
jest.mock('react-native-actions-sheet', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({children, ...props}: {children: React.ReactNode}) => (
      <MockView testID="sheet" {...props}>
        {children}
      </MockView>
    ),
  };
});
jest.mock('@/components/mushaf-options/MushafOptionsContent', () => ({
  MushafOptionsContent: () => null,
}));

import {
  MushafLayoutSheet,
  PHONE_SNAP_POINTS,
  visibleContentHeight,
} from '../MushafLayoutSheet';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function render(): TestRenderer.ReactTestRenderer {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <MushafLayoutSheet
        {...({sheetId: 'mushaf-layout'} as SheetProps<'mushaf-layout'>)}
      />,
    );
  });
  return renderer;
}

const hosts = (r: TestRenderer.ReactTestRenderer, testID: string) =>
  r.root.findAll(
    node => node.props.testID === testID && (node.type as unknown) === View,
  );

beforeEach(() => {
  mockIsTablet = false;
});

describe('visibleContentHeight', () => {
  it('cuts the content to the share of the sheet on screen', () => {
    // 1000pt sheet, 20pt of chrome above a 980pt content area.
    expect(visibleContentHeight(1000, 980, 0)).toBe(
      (1000 * PHONE_SNAP_POINTS[0]) / 100 - 20,
    );
  });

  it('leaves the content whole at the top point or before measuring', () => {
    expect(visibleContentHeight(1000, 980, 1)).toBeUndefined();
    expect(visibleContentHeight(1000, 0, 0)).toBeUndefined();
  });
});

describe('MushafLayoutSheet on a phone', () => {
  it('opens at the lower snap point with the content cut to what shows', () => {
    const r = render();
    const [sheet] = hosts(r, 'sheet');
    expect(sheet.props.snapPoints).toEqual(PHONE_SNAP_POINTS);
    expect(sheet.props.initialSnapIndex).toBe(0);

    const area = r.root.findAll(
      node =>
        (node.type as unknown) === View &&
        typeof node.props.onLayout === 'function',
    )[0];
    act(() => area.props.onLayout({nativeEvent: {layout: {height: 500}}}));
    const [content] = hosts(r, 'mushaf-layout-content');
    const flat = [content.props.style].flat();
    const height = flat.find(
      (style: {height?: number}) => style && style.height !== undefined,
    )?.height;
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThan(500);

    // Pulled up to the top point, the content fills the sheet again.
    act(() => sheet.props.onSnapIndexChange(1));
    const [full] = hosts(r, 'mushaf-layout-content');
    expect([full.props.style].flat()).toEqual([{flex: 1}]);
  });

  it('keeps the plain sheet on iPad', () => {
    mockIsTablet = true;
    const r = render();
    const [sheet] = hosts(r, 'sheet');
    expect(sheet.props.snapPoints).toBeUndefined();
  });
});
