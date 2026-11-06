// @ai-generated
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {capScreensExcept} from '../MaxWidthContainer';

const mockResponsive = {isTablet: true};
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

const layout = capScreensExcept(['index', 'browse-all']);

function render(routeName: string) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <>{layout({route: {name: routeName}, children: <Text>screen</Text>})}</>,
    );
  });
  return renderer;
}

// Compared by identity: react-test-renderer's own React types do not
// accept React Native component classes in findAllByType.
function views(renderer: TestRenderer.ReactTestRenderer) {
  const view: unknown = View;
  return renderer.root.findAll(node => node.type === view);
}

function columnWidths(renderer: TestRenderer.ReactTestRenderer) {
  return views(renderer)
    .map(view => StyleSheet.flatten(view.props.style)?.maxWidth)
    .filter(Boolean);
}

describe('capScreensExcept on tablets', () => {
  beforeEach(() => {
    mockResponsive.isTablet = true;
  });

  it('lets listed routes take the whole pane', () => {
    expect(columnWidths(render('browse-all'))).toEqual([]);
  });

  it('keeps other routes in the 720pt column', () => {
    expect(columnWidths(render('reciter/[id]'))).toEqual([720]);
  });
});

describe('capScreensExcept on phones', () => {
  it('leaves every route unwrapped', () => {
    mockResponsive.isTablet = false;
    expect(views(render('reciter/[id]'))).toHaveLength(0);
    expect(views(render('index'))).toHaveLength(0);
  });
});
