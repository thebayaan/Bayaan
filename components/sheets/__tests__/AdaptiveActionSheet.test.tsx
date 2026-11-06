// @ai-generated
import React from 'react';
import {StyleSheet, Text, View, type ViewStyle} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

type SheetProps = {
  containerStyle?: unknown;
  id?: string;
  gestureEnabled?: boolean;
  animated?: boolean;
  overlayColor?: string;
  children?: React.ReactNode;
};
const mockSheetProps: SheetProps[] = [];
const mockHide = jest.fn();
jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: ReactActual.forwardRef((props: SheetProps, ref: unknown) => {
      ReactActual.useImperativeHandle(ref, () => ({
        hide: () => mockHide(props.id),
      }));
      mockSheetProps.push(props);
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.children,
      );
    }),
  };
});

jest.mock('@/utils/rtl', () => ({
  appLayoutDirection: {direction: 'ltr'},
  forceLTR: {direction: 'ltr'},
}));

const mockResponsive = {width: 393, isTablet: false};
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

let mockTouch: {x: number; y: number} | null = null;
jest.mock('@/utils/lastTouch', () => ({
  getRecentTouch: () => mockTouch,
}));

import ActionSheet, {
  MENU_WIDTH,
  SHEET_MAX_WIDTH,
  getSheetWidth,
  placeMenu,
  toCardStyle,
  type TabletPresentation,
} from '@/components/sheets/AdaptiveActionSheet';

const base = {
  backgroundColor: 'white',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  borderTopWidth: 1,
  paddingTop: 8,
};

const mounted: TestRenderer.ReactTestRenderer[] = [];

/** The view the sheet's own background color lands on. */
function findCard(renderer: TestRenderer.ReactTestRenderer) {
  const view: unknown = View;
  const card = renderer.root.findAll(
    node =>
      node.type === view &&
      StyleSheet.flatten(node.props.style)?.backgroundColor === 'white',
  )[0];
  return card ? (StyleSheet.flatten(card.props.style) as ViewStyle) : null;
}

/** Props the library sheet with this id last rendered with. */
function latestSheetProps(id: string) {
  return mockSheetProps.filter(sheet => sheet.id === id).at(-1);
}

function render(tabletPresentation?: TabletPresentation, id = 'surah-options') {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ActionSheet
        id={id}
        containerStyle={base}
        tabletPresentation={tabletPresentation}>
        <Text>options</Text>
      </ActionSheet>,
    );
  });
  mounted.push(renderer);
  return {
    renderer,
    sheet: latestSheetProps(id) as SheetProps,
    card: findCard(renderer),
  };
}

function close(renderer: TestRenderer.ReactTestRenderer) {
  act(() => renderer.unmount());
  mounted.splice(mounted.indexOf(renderer), 1);
}

beforeEach(() => {
  mockTouch = null;
  mockHide.mockClear();
});

afterEach(() => {
  act(() => mounted.splice(0).forEach(renderer => renderer.unmount()));
});

it('passes the sheet through untouched on phones', () => {
  Object.assign(mockResponsive, {width: 393, isTablet: false});
  const {sheet, card} = render('menu');
  expect(sheet.containerStyle).toBe(base);
  expect(sheet.id).toBe('surah-options');
  expect(sheet.gestureEnabled).toBeUndefined();
  expect(card).toBeNull();
});

it('shows a centered card capped at 560pt on iPad', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  const {sheet, card} = render();
  expect(sheet.id).toBe('surah-options');
  expect(sheet.gestureEnabled).toBe(false);
  expect(sheet.containerStyle).not.toBe(base);
  expect(card).toMatchObject({
    maxWidth: SHEET_MAX_WIDTH,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  });
  expect(card?.position).toBeUndefined();
});

it('floats a menu beside the tap that opened it', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  mockTouch = {x: 900, y: 400};
  const {sheet, card} = render('menu');
  expect(sheet.animated).toBe(false);
  // Hidden until it has been measured and placed, and no extra padding
  // below the content.
  expect(card).toMatchObject({
    position: 'absolute',
    width: MENU_WIDTH,
    opacity: 0,
    paddingBottom: 0,
  });
});

it('hides a menu under the sheet its item opens, and closes it after', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  mockTouch = {x: 900, y: 400};
  const menu = render('menu', 'surah-options');
  const playlists = render('card', 'select-playlist');
  // The menu stays open, because the new sheet renders inside it.
  expect(mockHide).not.toHaveBeenCalled();
  expect(findCard(menu.renderer)).toMatchObject({opacity: 0});
  expect(latestSheetProps('surah-options')?.overlayColor).toBe('transparent');
  expect(latestSheetProps('select-playlist')?.overlayColor).toBeUndefined();

  close(playlists.renderer);
  expect(mockHide.mock.calls).toEqual([['surah-options']]);
});

it('keeps the menu open until the sheet over it closes', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  mockTouch = {x: 900, y: 400};
  render('menu', 'surah-options');
  const playlists = render('card', 'select-playlist');
  const create = render('card', 'create-playlist');
  close(create.renderer);
  expect(mockHide).not.toHaveBeenCalled();
  close(playlists.renderer);
  expect(mockHide.mock.calls).toEqual([['surah-options']]);
});

it('leaves an open card under the sheet that opens over it', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  const playlists = render('card', 'select-playlist');
  const create = render('card', 'create-playlist');
  expect(findCard(playlists.renderer)?.opacity).toBeUndefined();
  close(create.renderer);
  expect(mockHide).not.toHaveBeenCalled();
});

it('falls back to a card when no recent tap opened the menu', () => {
  Object.assign(mockResponsive, {width: 1032, isTablet: true});
  const {card} = render('menu');
  expect(card).toMatchObject({maxWidth: SHEET_MAX_WIDTH});
  expect(card?.position).toBeUndefined();
});

describe('placeMenu', () => {
  const area = {width: 1032, height: 1300};
  const menu = {width: 340, height: 400};

  it('opens below the tap, away from the nearer side', () => {
    // 24pt below the tap, clear of the button that was tapped.
    expect(placeMenu({x: 900, y: 300}, menu, area)).toEqual({x: 560, y: 324});
    expect(placeMenu({x: 100, y: 300}, menu, area)).toEqual({x: 100, y: 324});
  });

  it('centers under a tap in the middle third, like a wide button', () => {
    // The iPad mini's Add to Collection button, tapped in its middle.
    expect(
      placeMenu({x: 415, y: 60}, menu, {width: 744, height: 1133}),
    ).toEqual({x: 245, y: 84});
  });

  it('opens above the tap when there is no room below', () => {
    expect(placeMenu({x: 900, y: 1100}, menu, area)).toEqual({
      x: 560,
      y: 676,
    });
  });

  it('stays clear of the edges', () => {
    expect(placeMenu({x: 1030, y: 0}, menu, area)).toEqual({x: 668, y: 24});
    expect(placeMenu({x: 5, y: 300}, menu, area)).toEqual({x: 24, y: 324});
    // Taller than the window: pinned to the top margin.
    expect(
      placeMenu({x: 100, y: 600}, {width: 340, height: 1400}, area).y,
    ).toBe(24);
  });
});

it('rounds every corner of a card and pads it for the missing handle', () => {
  expect(toCardStyle(base)).toMatchObject({
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    paddingTop: 20,
    paddingBottom: 16,
  });
});

it('reports the width the sheet is drawn at', () => {
  expect(getSheetWidth(393, false)).toBe(393);
  expect(getSheetWidth(1032, true)).toBe(SHEET_MAX_WIDTH);
  // A narrow iPad window (Slide Over) is narrower than the cap.
  expect(getSheetWidth(320, true)).toBe(320);
});
