// @ai-generated
/**
 * A Mushaf 1440 page end to end, with the app's own data and overlay code:
 * the 1441H layout and the real V4 page font's glyph advances (page 50), the
 * real Hafs words and DigitalKhatt layout (through the fixture stand-in of
 * the data service), and the real settings, selection and recitation stores.
 * Skia is a recorder: the test reads what the page asks it to draw. Checks
 * the features the page shares with the DigitalKhatt pages: the selection
 * band, a mistake in red with its underline, hidden words while memorising,
 * and the mistake sheet on a tap of a marked word.
 */
import * as path from 'path';
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {readTtfMetrics} from '@/services/mushaf/__fixtures__/ttfMetrics';
import {hasNodeSqlite} from '@/services/mushaf/__fixtures__/bundledDkSqlite';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const actual = jest.requireActual(
    '@/services/mushaf/DigitalKhattDataService',
  );
  const {createFakeDKService} = jest.requireActual(
    '@/services/mushaf/__fixtures__/rewayahOverlayFixture',
  );
  const service = createFakeDKService();
  // The identity of the text served (getPageTextIdentity).
  service.getLayoutIdentityKey = () =>
    `${service.rewayah}@fixture.${service.getCacheVersion()}`;
  return {...actual, digitalKhattDataService: service};
});

jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => null}),
}));

const mockSheet = {show: jest.fn(() => Promise.resolve())};
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: (...args: unknown[]) => mockSheet.show(...(args as [])),
    hide: () => Promise.resolve(),
  },
}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
jest.mock('expo-haptics', () => ({
  impactAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: {Light: 'light', Medium: 'medium', Heavy: 'heavy'},
}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAnnotationsForSurah: async () => ({
      bookmarks: [],
      notes: [],
      highlights: [],
    }),
  },
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {isDarkMode: false, colors: {text: '#000'}},
    isDarkMode: false,
  }),
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fontMgr: true}),
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {quranCommonTypeface: null},
}));
jest.mock('react-native-worklets', () => ({
  runOnJS: (fn: unknown) => fn,
}));
// The player store's native edges (its state is real).
jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

// Gesture builders that keep their callbacks, so the test can fire them.
const mockGestures: {tap?: (e: {x: number; y: number}) => void} = {};
jest.mock('react-native-gesture-handler', () => {
  const chain = (kind: string) => {
    const handlers: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {};
    for (const method of [
      'minDuration',
      'maxDistance',
      'activateAfterLongPress',
      'minDistance',
      'onStart',
      'onUpdate',
      'onEnd',
    ]) {
      builder[method] = (arg: unknown) => {
        handlers[method] = arg;
        if (kind === 'tap' && method === 'onEnd') {
          mockGestures.tap = arg as never;
        }
        return builder;
      };
    }
    return builder;
  };
  return {
    GestureDetector: ({children}: {children: React.ReactNode}) => children,
    Gesture: {
      Tap: () => chain('tap'),
      Pan: () => chain('pan'),
      LongPress: () => chain('longPress'),
      Exclusive: (...gestures: unknown[]) => gestures,
    },
  };
});

// The V4 font of page 50, as the loader would hand it out: glyph ids and
// advances read from the real file.
const PAGE = 50;
const mockMetrics = readTtfMetrics(
  path.join(process.cwd(), `data/mushaf/legacy/QPCTajweed/p${PAGE}.ttf`),
);
const mockTypeface = (variant: string) => ({
  variant,
  getGlyphIDs: (text: string) =>
    [...text].map(char => mockMetrics.glyphId(char.codePointAt(0)!)),
});
const mockTypefaces = new Map<string, ReturnType<typeof mockTypeface>>();
const mockLoader = {
  ensure: jest.fn(async (_page: number, variant: string) => {
    if (!mockTypefaces.has(variant)) {
      mockTypefaces.set(variant, mockTypeface(variant));
    }
    return mockTypefaces.get(variant)!;
  }),
};
jest.mock('@/services/mushaf/QCFFontLoader', () => ({
  ...jest.requireActual('@/services/mushaf/QCFFontLoader'),
  qcfFontLoader: {
    getTypeface: (_page: number, variant: string) =>
      mockTypefaces.get(variant) ?? null,
    peekTypeface: (_page: number, variant: string) =>
      mockTypefaces.get(variant) ?? null,
    ensure: (page: number, variant: string) => mockLoader.ensure(page, variant),
    prefetch: () => undefined,
  },
}));

jest.mock('@shopify/react-native-skia', () => {
  const builder = () => {
    const b = {
      pushStyle: () => b,
      pop: () => b,
      addText: () => b,
      build: () => ({
        layout: () => undefined,
        getHeight: () => 30,
        dispose: () => undefined,
      }),
    };
    return b;
  };
  return {
    Canvas: 'Canvas',
    Group: 'Group',
    Glyphs: 'Glyphs',
    Paragraph: 'Paragraph',
    RoundedRect: 'RoundedRect',
    Line: 'Line',
    DashPathEffect: 'DashPathEffect',
    vec: (x: number, y: number) => ({x, y}),
    TextAlign: {Center: 2},
    TextDirection: {RTL: 0},
    TextHeightBehavior: {DisableAll: 3},
    Skia: {
      Color: (color: string) => color,
      Font: (typeface: unknown, size: number) => ({
        typeface,
        size,
        setSubpixel: () => undefined,
        setLinearMetrics: () => undefined,
        getGlyphWidths: (ids: number[]) =>
          ids.map(
            id => (mockMetrics.advance(id) / mockMetrics.unitsPerEm) * size,
          ),
      }),
      ParagraphBuilder: {Make: () => builder()},
    },
  };
});

import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {qcfDataService} from '@/services/mushaf/QCFDataService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {
  RECITATION_TRACKING_IDLE,
  useRecitationTrackingStore,
} from '@/store/recitationTrackingStore';
import type {WordMark} from '@/services/recitation/wordMarks';
import QCFPage, {type QCFPageFrame} from '../QCFPage';

const FRAME: QCFPageFrame = {
  width: 393,
  height: 852,
  contentLeft: 8,
  contentTop: 130,
  contentWidth: 377,
  contentHeight: 622,
  lineHeight: 622 / 15,
  centerOpeningPages: true,
};
const TEXT = '#1a1a1a';
const MISTAKE = '#D32F2F';

interface DrawnGlyphs {
  color: string;
  glyphs: Array<{id: number; pos: {x: number; y: number}}>;
  style?: string;
}

const run = hasNodeSqlite() ? describe : describe.skip;

run('Mushaf 1440 page', () => {
  beforeAll(() => {
    // The Hafs words and DigitalKhatt layout of the page, from the bundled
    // DBs, served by the data service stand-in.
    const {DatabaseSync} = require('node:sqlite');
    const dir = path.join(process.cwd(), 'data/mushaf/digitalkhatt');
    const layout = new DatabaseSync(
      path.join(dir, 'digital-khatt-15-lines.db'),
      {readOnly: true},
    );
    const lines = layout
      .prepare(
        `SELECT page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number FROM pages WHERE page_number BETWEEN ${PAGE - 1} AND ${PAGE} ORDER BY page_number, line_number`,
      )
      .all() as DKLine[];
    layout.close();
    const words = new DatabaseSync(path.join(dir, 'digital-khatt-v2.db'), {
      readOnly: true,
    });
    const ids = lines
      .filter(line => line.line_type === 'ayah')
      .flatMap(line => [Number(line.first_word_id), Number(line.last_word_id)]);
    const rows = words
      .prepare('SELECT id, location, text FROM words WHERE id BETWEEN ? AND ?')
      .all(Math.min(...ids), Math.max(...ids)) as Array<{
      id: number;
      location: string;
      text: string;
    }>;
    words.close();
    (
      digitalKhattDataService as unknown as {
        loadData(data: object): void;
      }
    ).loadData({
      rewayah: 'hafs',
      words: rows.map(row => [row.id, row.location, row.text]),
      lines,
    });
  });

  beforeEach(() => {
    mockTypefaces.clear();
    mockLoader.ensure.mockClear();
    mockSheet.show.mockClear();
    useMushafSettingsStore.setState({
      mushafRenderer: 'qcf_v2',
      rewayah: 'hafs',
      showTajweed: false,
      showThemes: false,
      showAllahNameHighlight: false,
      recitationHideText: false,
      arabicTextWeight: 'normal',
    });
    useMushafVerseSelectionStore.getState().clearSelection();
    useRecitationTrackingStore.setState(RECITATION_TRACKING_IDLE);
  });

  let mounted: TestRenderer.ReactTestRenderer | null = null;
  afterEach(() => {
    act(() => mounted?.unmount());
    mounted = null;
  });

  async function draw(): Promise<TestRenderer.ReactTestRenderer> {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <QCFPage
          pageNumber={PAGE}
          textColor={TEXT}
          dividerColor="#888"
          frame={FRAME}
        />,
      );
    });
    mounted = tree;
    // The font resolves, then the plain variant if a word needs it.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    return tree;
  }

  const drawn = (tree: TestRenderer.ReactTestRenderer, type: string) =>
    tree.root
      .findAll(node => (node.type as unknown) === type)
      .map(node => node.props);

  const glyphRuns = (tree: TestRenderer.ReactTestRenderer) =>
    (drawn(tree, 'Glyphs') as DrawnGlyphs[]).filter(g => g.style !== 'stroke');

  const pageWords = () =>
    qcfDataService.getPage(PAGE).lines.flatMap(line => line.words);

  /** Glyph ids of a word, as the page font maps its code. */
  const glyphIdsOf = (location: string) => {
    const word = pageWords().find(w => w.location === location)!;
    return [...word.code].map(c => mockMetrics.glyphId(c.codePointAt(0)!));
  };

  it('draws every glyph of the page in the text colour', async () => {
    const tree = await draw();
    const runs = glyphRuns(tree);
    const glyphCount = pageWords().reduce((n, w) => n + w.code.length, 0);
    expect(runs.every(r => r.color === TEXT)).toBe(true);
    expect(runs.reduce((n, r) => n + r.glyphs.length, 0)).toBe(glyphCount);
    expect(mockLoader.ensure).toHaveBeenCalledWith(PAGE, 'v4-mono');
  });

  it('paints the selection band over the selected verse', async () => {
    useMushafVerseSelectionStore.getState().selectVerse('3:3', PAGE);
    const tree = await draw();
    const bands = drawn(tree, 'RoundedRect') as Array<{
      x: number;
      width: number;
      color: string;
    }>;
    expect(bands.length).toBeGreaterThan(0);
    // The verse's glyphs are all inside the bands' horizontal reach.
    const verseIds = new Set(
      pageWords()
        .filter(w => w.verseKey === '3:3')
        .flatMap(w => glyphIdsOf(w.location)),
    );
    const xs = glyphRuns(tree)
      .flatMap(r => r.glyphs)
      .filter(g => verseIds.has(g.id))
      .map(g => g.pos.x);
    const left = Math.min(...bands.map(b => b.x));
    const right = Math.max(...bands.map(b => b.x + b.width));
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(left);
      expect(x).toBeLessThanOrEqual(right);
    }
  });

  it('draws a mistake in red with a dotted underline, and opens it on a tap', async () => {
    const mark: WordMark = {
      surah: 3,
      ayah: 3,
      word: 2,
      totalWords: 12,
      kind: 'wrong',
      status: 'mistake',
      since: 0,
    };
    useRecitationTrackingStore.setState({marks: [mark]});
    const tree = await draw();

    const red = glyphRuns(tree).filter(r => r.color === MISTAKE);
    expect(red).toHaveLength(1);
    expect(red[0].glyphs.map(g => g.id)).toEqual(glyphIdsOf('3:3:2'));
    const underlines = (drawn(tree, 'Line') as Array<{color: string}>).filter(
      l => l.color === MISTAKE,
    );
    expect(underlines).toHaveLength(1);

    // A tap on the word opens the mistake sheet for it.
    const [glyph] = red[0].glyphs;
    const advance =
      (mockMetrics.advance(glyph.id) / mockMetrics.unitsPerEm) * 22;
    await act(async () => {
      mockGestures.tap!({
        x: FRAME.contentLeft + glyph.pos.x + advance / 2,
        y: FRAME.contentTop + glyph.pos.y - 5,
      });
    });
    expect(mockSheet.show).toHaveBeenCalledWith('recitation-mistake', {
      payload: {mark},
    });
  });

  it('hides the words not yet recited while memorising', async () => {
    useMushafSettingsStore.setState({recitationHideText: true});
    useRecitationTrackingStore.setState({
      status: 'listening',
      revealedThrough: {surah: 3, ayah: 2, position: Number.MAX_SAFE_INTEGER},
    });
    const tree = await draw();
    const shown = new Set(
      glyphRuns(tree).flatMap(r => r.glyphs.map(g => g.id)),
    );
    let hidden = 0;
    for (const word of pageWords()) {
      const visible = glyphIdsOf(word.location).every(id => shown.has(id));
      const [, ayah] = word.verseKey.split(':').map(Number);
      // Ayah markers stay, as on the DigitalKhatt pages: the reader keeps
      // their place.
      const isMarker = digitalKhattDataService
        .getWordInfo(word.id)!
        .text.startsWith('\u06DD');
      expect(visible).toBe(isMarker || ayah <= 2);
      if (!visible) hidden++;
    }
    expect(hidden).toBeGreaterThan(100);
  });

  it('draws a recoloured word from the plain outlines under tajweed', async () => {
    useMushafSettingsStore.setState({showTajweed: true});
    useRecitationTrackingStore.setState({
      marks: [
        {
          surah: 3,
          ayah: 3,
          word: 2,
          totalWords: 12,
          kind: 'missed',
          status: 'mistake',
          since: 0,
        },
      ],
    });
    await draw();
    expect(mockLoader.ensure).toHaveBeenCalledWith(PAGE, 'v4');
    expect(mockLoader.ensure).toHaveBeenCalledWith(PAGE, 'v4-mono');
  });
});
