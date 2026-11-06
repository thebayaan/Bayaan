// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {ExploreView, interleaveColumns} from '../ExploreView';
import {getAllSystemPlaylists} from '@/data/systemPlaylists';

const mockResponsive = {isTablet: true};
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));
jest.mock('@/hooks/useGlassProps', () => ({
  USE_GLASS: false,
  useGlassColorScheme: () => 'light',
}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#000000', textSecondary: '#666666'}},
  }),
}));
jest.mock('expo-glass-effect', () => ({GlassView: 'GlassView'}));
jest.mock('expo-router', () => {
  const Link = ({children}: {children: React.ReactNode}) => children;
  Link.AppleZoom = ({children}: {children: React.ReactNode}) => children;
  return {Link};
});

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ExploreView />);
  });
  return renderer;
}

function layout(renderer: TestRenderer.ReactTestRenderer, width: number) {
  act(() => {
    renderer.root
      .findAll(n => typeof n.props.onLayout === 'function')[0]
      .props.onLayout({nativeEvent: {layout: {width, height: 1000}}});
  });
}

// The size each tile is given (BentoTileComponent's `dimensions`).
function tileSizes(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll(n => typeof n.type !== 'string' && n.props.dimensions)
    .map(n => n.props.dimensions as {width: number; height: number});
}

describe('interleaveColumns', () => {
  it('reads the two phone columns row by row', () => {
    const order = interleaveColumns(getAllSystemPlaylists()).map(p => p.id);
    expect(order.slice(0, 4)).toEqual([
      'morning-reflections',
      'evening-serenity',
      'quick-listen',
      'friday-essentials',
    ]);
    expect(order).toHaveLength(getAllSystemPlaylists().length);
  });
});

describe('ExploreView on iPad', () => {
  beforeEach(() => {
    mockResponsive.isTablet = true;
  });

  it('waits for its own width before drawing tiles', () => {
    expect(tileSizes(render())).toHaveLength(0);
  });

  it('fills a 13" portrait pane with four columns', () => {
    const renderer = render();
    layout(renderer, 944);
    const sizes = tileSizes(renderer);
    const playlists = getAllSystemPlaylists().length;
    expect(sizes).toHaveLength(2 + playlists);
    // Two Browse All tiles share the first row.
    expect(sizes[0]).toEqual(sizes[1]);
    expect(sizes[0].width * 2).toBeLessThanOrEqual(944 - 32 - 12);
    // Four 1.6:1 playlist tiles per row.
    const tile = sizes[2];
    expect(tile.width * 4 + 12 * 3).toBeLessThanOrEqual(944 - 32);
    expect(tile.width * 5 + 12 * 4).toBeGreaterThan(944 - 32);
    expect(tile.height).toBe(Math.floor(tile.width / 1.6));
    expect(new Set(sizes.slice(2).map(s => s.width)).size).toBe(1);
  });

  it('keeps three columns on the iPad mini', () => {
    const renderer = render();
    layout(renderer, 656);
    const tile = tileSizes(renderer)[2];
    expect(tile.width * 3 + 12 * 2).toBeLessThanOrEqual(656 - 32);
    expect(tile.width * 4 + 12 * 3).toBeGreaterThan(656 - 32);
  });
});

describe('ExploreView on phones', () => {
  it('keeps the two-column bento', () => {
    mockResponsive.isTablet = false;
    const sizes = tileSizes(render());
    expect(sizes.length).toBeGreaterThan(2);
    // Bento tiles come in two heights; the iPad grid has one.
    expect(new Set(sizes.map(s => s.height)).size).toBe(2);
  });
});
