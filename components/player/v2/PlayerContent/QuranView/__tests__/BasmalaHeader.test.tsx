// @ai-generated
/**
 * BasmalaHeader (player, reading page and continuous list surah headers)
 * draws the surah-opening basmala of the rewayah of the verses below it
 * (contract C6), in the surah's own spelling, never the Hafs text for another
 * rewayah; Hafs is unchanged.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface FakeParagraph {
  text: string;
  layout: () => void;
  getLongestLine: () => number;
  getHeight: () => number;
}

const mockDrawn: string[] = [];

jest.mock('@shopify/react-native-skia', () => {
  const ReactActual = jest.requireActual('react');
  return {
    Canvas: ({children}: {children: React.ReactNode}) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
    Paragraph: ({paragraph}: {paragraph: FakeParagraph}) => {
      mockDrawn.push(paragraph.text);
      return null;
    },
    Skia: {
      Color: (c: string) => c,
      ParagraphBuilder: {
        Make: () => {
          let text = '';
          return {
            pushStyle: () => undefined,
            pop: () => undefined,
            addText: (t: string) => {
              text += t;
            },
            build: (): FakeParagraph => ({
              text,
              layout: () => undefined,
              getLongestLine: () => 100,
              getHeight: () => 40,
            }),
          };
        },
      },
    },
    TextHeightBehavior: {DisableAll: 0},
    TextDirection: {RTL: 0},
    PaintStyle: {Stroke: 1},
    StrokeCap: {Round: 1},
    StrokeJoin: {Round: 1},
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockTajweed = jest.fn(() => new Map([[0, 'ghunnah']]));
jest.mock('@/services/mushaf/DigitalKhattVerseTajweedService', () => ({
  getBasmalaTajweedMap: () => mockTajweed(),
}));

import BasmalaHeader from '../BasmalaHeader';
import {BASMALLAH_TEXT} from '@/services/mushaf/RewayahBasmalaService';
import {EXPECTED_BASMALA} from '@/services/mushaf/__fixtures__/basmalaTexts';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const FONT_MGR = {} as SkTypefaceFontProvider;
const TAJWEED = {} as IndexedTajweedData;

/** Renders one header; returns the text it draws ('' when nothing). */
function draw(props: {
  rewayah?: RewayahId;
  surahNumber?: number;
  fontMgr?: SkTypefaceFontProvider | null;
  showTajweed?: boolean;
}): string {
  mockDrawn.length = 0;
  let out: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    out = TestRenderer.create(
      <BasmalaHeader
        visible
        width={320}
        textColor="#111111"
        showTajweed={props.showTajweed ?? false}
        fontMgr={props.fontMgr === undefined ? FONT_MGR : props.fontMgr}
        dkFontFamily="DigitalKhattV2"
        indexedTajweedData={TAJWEED}
        rewayah={props.rewayah}
        surahNumber={props.surahNumber}
      />,
    );
  });
  // Skia path: the paragraphs drawn; text fallback: the host text rendered
  // (one <Text> per character inside an outer <Text>).
  const drawn =
    props.fontMgr === null ? hostText(out!.toJSON()) : mockDrawn.join('');
  act(() => out!.unmount());
  return drawn;
}

type JsonNode = TestRenderer.ReactTestRendererJSON | string;

function hostText(
  node: JsonNode | JsonNode[] | TestRenderer.ReactTestRendererJSON[] | null,
): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(n => hostText(n)).join('');
  return hostText(node.children);
}

beforeEach(() => {
  mockTajweed.mockClear();
  act(() => useMushafSettingsStore.setState({rewayah: 'hafs'}));
});

describe('BasmalaHeader', () => {
  it('Hafs: BASMALLAH_TEXT, with Hafs tajweed when enabled', () => {
    expect(draw({surahNumber: 2, showTajweed: true})).toBe(BASMALLAH_TEXT);
    expect(mockTajweed).toHaveBeenCalled();
    expect(draw({rewayah: 'hafs', surahNumber: 15})).toBe(BASMALLAH_TEXT);
  });

  it("a rewayah track draws that rewayah's basmala (and no Hafs tajweed)", () => {
    expect(draw({rewayah: 'warsh', surahNumber: 2, showTajweed: true})).toBe(
      EXPECTED_BASMALA.warsh!.dk,
    );
    expect(mockTajweed).not.toHaveBeenCalled();
    // The paragraph cache is keyed by the text: switching back redraws Hafs.
    expect(draw({rewayah: 'hafs', surahNumber: 2})).toBe(BASMALLAH_TEXT);
  });

  it("uses the surah's own spelling (al-Susi 14, Qalun 95)", () => {
    const susi = EXPECTED_BASMALA['al-susi']!;
    expect(draw({rewayah: 'al-susi', surahNumber: 13})).toBe(susi.dk);
    expect(draw({rewayah: 'al-susi', surahNumber: 14})).toBe(
      susi.bySurah[14].dk,
    );
    // Without a rewayah prop: the mushaf's rewayah.
    act(() => useMushafSettingsStore.setState({rewayah: 'qalun'}));
    expect(draw({surahNumber: 95})).toBe(
      EXPECTED_BASMALA.qalun!.bySurah[95].dk,
    );
  });

  it('the text fallback (no fonts) draws the same basmala', () => {
    expect(draw({rewayah: 'al-susi', surahNumber: 15, fontMgr: null})).toBe(
      EXPECTED_BASMALA['al-susi']!.bySurah[15].dk,
    );
    expect(draw({surahNumber: 2, fontMgr: null})).toBe(BASMALLAH_TEXT);
  });

  it('a rewayah without basmala data draws nothing rather than Hafs', () => {
    expect(draw({rewayah: 'hisham', surahNumber: 2})).toBe('');
    expect(draw({rewayah: 'hisham', surahNumber: 2, fontMgr: null})).toBe('');
  });
});
