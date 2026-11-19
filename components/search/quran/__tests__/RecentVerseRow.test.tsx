// @ai-generated
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {fixtureUnits} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import {quranHitOpenParams} from '@/utils/search/quranHitParams';
import {RecentVerseRow} from '../RecentVerseRow';

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {text: '#000000'}}}),
}));
// The mushaf's rewayah, and whether its verse units are built.
let mockRewayah: RewayahId = 'hafs';
let mockUnitsReady = true;
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (select: (s: {rewayah: RewayahId}) => unknown) =>
    select({rewayah: mockRewayah}),
}));
jest.mock('@/hooks/useRewayahVerseUnits', () => ({
  useRewayahVerseUnits: (rewayah: RewayahId | null) => {
    if (!rewayah) return {units: null, status: 'unavailable'};
    if (!mockUnitsReady) return {units: null, status: 'loading'};
    const {
      fixtureUnits: units,
    } = require('@/services/verse-annotations/__fixtures__/verseUnitsTestData');
    return {units: units(rewayah), status: 'ready'};
  },
}));

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

/** The row's label, as shown and as read out. */
function labelOf(verseKey: string, positions: number[]): string {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <RecentVerseRow
        verseKey={verseKey}
        positions={positions}
        onPress={jest.fn()}
      />,
    );
  });
  const button = renderer.root.find(
    n =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function' &&
      typeof n.type !== 'string',
  );
  const text: unknown = Text;
  const shown = renderer.root.find(n => n.type === text).props.children;
  const label: string = button.props.accessibilityLabel;
  expect(shown).toBe(label);
  act(() => renderer.unmount());
  return label;
}

beforeEach(() => {
  mockRewayah = 'hafs';
  mockUnitsReady = true;
});

describe('RecentVerseRow', () => {
  it('names the ayah and opens it', () => {
    const onPress = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <RecentVerseRow verseKey="2:255" positions={[3]} onPress={onPress} />,
      );
    });
    const button = renderer.root.find(
      n =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        typeof n.type !== 'string',
    );
    expect(button.props.accessibilityLabel).toBe('Al-Baqarah 2:255');
    expect(button.props.accessibilityHint).toBe('Opens the ayah in the Mushaf');
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it("names the verse the reader selects in the mushaf's rewayah", () => {
    mockRewayah = 'warsh';
    // Hafs 106:4 is two Warsh verses: 106:4 (words 1-4) and 106:5 (5-8).
    // The reader opens on the first matched slot and selects the Warsh verse
    // holding it: the row names that verse.
    const units = fixtureUnits('warsh');
    const cases: [number[], string][] = [
      [[7], '106:5'],
      [[2, 3], '106:4'],
      [[7, 2], '106:4'],
    ];
    for (const [positions, verse] of cases) {
      const {anchor} = quranHitOpenParams('106:4', positions);
      expect(units.unitForAnchor(anchor)?.key).toBe(verse);
      expect(labelOf('106:4', positions)).toBe(`Quraysh ${verse} · Warsh`);
    }
  });

  it("names the Hafs verse, saying so, while the rewayah's verses load", () => {
    mockRewayah = 'warsh';
    mockUnitsReady = false;
    expect(labelOf('106:4', [7])).toBe('Quraysh 106:4 · Hafs');
  });

  it('names the Hafs verse, saying so, for the unnumbered Fatiha basmala', () => {
    // Warsh does not number the basmala: no Warsh verse holds its words.
    mockRewayah = 'warsh';
    expect(labelOf('1:1', [2])).toBe('Al-Fatihah 1:1 · Hafs');
    expect(labelOf('1:2', [1])).toBe('Al-Fatihah 1:1 · Warsh');
  });

  it('keeps the Hafs label with Hafs in the mushaf', () => {
    expect(labelOf('106:4', [7])).toBe('Quraysh 106:4');
  });
});
