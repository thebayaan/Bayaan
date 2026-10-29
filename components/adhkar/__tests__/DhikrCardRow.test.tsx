// @ai-generated
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

let mockTablet = true;
let mockWidth = 1032;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: mockTablet, width: mockWidth}),
}));

import {
  DhikrCardRow,
  DhikrListWidth,
  chunkRows,
  dhikrColumns,
  rowOf,
} from '@/components/adhkar/DhikrCardRow';

beforeEach(() => {
  mockTablet = true;
  mockWidth = 1032;
});

describe('dhikrColumns', () => {
  it('keeps one card per row on phones and narrow iPads', () => {
    expect(dhikrColumns(false, 1032)).toEqual({columns: 1, spacing: null});
    expect(dhikrColumns(true, 834)).toEqual({columns: 1, spacing: null});
    expect(dhikrColumns(true, 899)).toEqual({columns: 1, spacing: null});
  });

  it('pairs the cards from the expanded width class', () => {
    expect(dhikrColumns(true, 1032)).toEqual({
      columns: 2,
      spacing: {margin: 32, gap: 20},
    });
    expect(dhikrColumns(true, 1366)).toEqual({
      columns: 2,
      spacing: {margin: 40, gap: 24},
    });
  });
});

describe('rows', () => {
  it('splits cards into rows with a short last row', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRows([1, 2], 1)).toEqual([[1], [2]]);
    expect(chunkRows([], 2)).toEqual([]);
  });

  it('finds the row that holds a card', () => {
    expect(rowOf(0, 2)).toBe(0);
    expect(rowOf(5, 2)).toBe(2);
    expect(rowOf(5, 1)).toBe(5);
  });
});

describe('DhikrCardRow', () => {
  it('keeps a lone last card at column width', () => {
    let r = {} as TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <DhikrCardRow spacing={{margin: 32, gap: 20}} columns={2}>
          {[<Text key="a">a</Text>]}
        </DhikrCardRow>,
      );
    });
    const row = r.root.findAll(n => (n.type as unknown) === View)[0];
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      flexDirection: 'row',
      gap: 20,
      paddingHorizontal: 32,
      marginBottom: 20,
    });
    const spacers = row.findAll(n => (n.type as unknown) === View && n !== row);
    expect(spacers).toHaveLength(1);
    expect(StyleSheet.flatten(spacers[0].props.style)).toEqual({flex: 1});
  });
});

describe('DhikrListWidth', () => {
  const capped = (r: TestRenderer.ReactTestRenderer) =>
    r.root.findAll(
      n =>
        (n.type as unknown) === View &&
        StyleSheet.flatten(n.props.style)?.maxWidth === 720,
    ).length > 0;

  it('gives a paired list the whole pane', () => {
    let r = {} as TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <DhikrListWidth>
          <Text>list</Text>
        </DhikrListWidth>,
      );
    });
    expect(capped(r)).toBe(false);
  });

  it('keeps a single-column list in the 720pt column', () => {
    mockWidth = 834;
    let r = {} as TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <DhikrListWidth>
          <Text>list</Text>
        </DhikrListWidth>,
      );
    });
    expect(capped(r)).toBe(true);
  });
});
