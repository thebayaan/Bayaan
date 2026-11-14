// @ai-generated
/**
 * The Readings section of the word view over real rows of the bundled index
 * (wordReadingsFixture.json): groups, readers and texts in English and
 * Arabic, the Current badge, not read, notes, a word with no row, loading,
 * error and retry. ReadingText is replaced by a recorder, as
 * SimilarVersesContent's tests replace SkiaVerseText: every Quran text goes
 * through it and none through a Text node.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {ActivityIndicator, Text} from 'react-native';
import i18n from 'i18next';
import {decodeReadingsRow} from '@/services/mushaf/wordReadingsFormat';
import type {WordReadingsResult} from '@/hooks/useWordReadings';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

interface MockReadingTextProps {
  text: string;
  rewayah: string;
  fontSize: number;
  silahChars?: readonly number[];
}
const mockReadingTexts: MockReadingTextProps[] = [];
const mockState: {
  result: WordReadingsResult;
  calls: [string, number][];
  currentWords: {text: string; wordPositionInVerse: number}[] | null;
} = {result: {status: 'loading'}, calls: [], currentWords: null};

jest.mock('../ReadingText', () => ({
  __esModule: true,
  default: (props: MockReadingTextProps) => {
    mockReadingTexts.push(props);
    return null;
  },
}));

jest.mock('@/hooks/useWordReadings', () => ({
  useWordReadings: (verseKey: string, wbwPosition: number) => {
    mockState.calls.push([verseKey, wbwPosition]);
    return mockState.result;
  },
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    tryGetVerseWords: () => mockState.currentWords,
  },
}));

jest.mock('@/components/sheets/AdaptiveActionSheet', () => ({
  useSheetWidth: () => 400,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
        primary: '#222222',
      },
    },
  }),
}));

import {WordReadingsSection} from '../WordReadingsSection';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

interface FixtureWord {
  verseKey: string;
  position: number;
  wordId: number;
  data: string | null;
}
const fixture =
  require('@/services/mushaf/__fixtures__/wordReadingsFixture.json') as {
    words: FixtureWord[];
  };

function ready(verseKey: string, position: number): WordReadingsResult {
  const w = fixture.words.find(
    x => x.verseKey === verseKey && x.position === position,
  );
  if (!w?.data) throw new Error(`${verseKey}:${position} has no row`);
  return {
    status: 'ready',
    readings: decodeReadingsRow(w.verseKey, w.position, w.wordId, w.data),
    dkPositions: [position],
  };
}

// An inline verse marker (U+06DD + Arabic-Indic two): never part of the word.
const VERSE_TWO = String.fromCharCode(0x06dd, 0x0662);

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(
  verseKey: string,
  wbwPosition: number,
  currentRewayah: RewayahId,
): TestRenderer.ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(
      <WordReadingsSection
        verseKey={verseKey}
        wbwPosition={wbwPosition}
        currentRewayah={currentRewayah}
      />,
    );
  });
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** Every string drawn in a Text node. */
function texts(root: TestRenderer.ReactTestInstance): string[] {
  return root
    .findAll(n => (n.type as unknown) === Text)
    .map(n => [n.props.children].flat().join(''));
}

/** The accessibility labels of the rows (group and member lines). */
function labels(root: TestRenderer.ReactTestInstance): string[] {
  return root
    .findAll(
      n =>
        typeof n.type === 'string' &&
        n.props.accessible === true &&
        !!n.props.accessibilityLabel,
    )
    .map(n => String(n.props.accessibilityLabel));
}

beforeEach(() => {
  mockReadingTexts.length = 0;
  mockState.calls.length = 0;
  mockState.currentWords = null;
  mockState.result = {status: 'loading'};
});

afterEach(async () => {
  act(() => renderer?.unmount());
  renderer = null;
  await i18n.changeLanguage('en');
});

it('asks for the word it is given', () => {
  render('2:181', 3, 'hafs');
  expect(mockState.calls[0]).toEqual(['2:181', 3]);
});

it('1:4:1: Hafs, then the other six, with their readers, in English', () => {
  mockState.result = ready('1:4', 1);
  const root = render('1:4', 1, 'hafs');
  const shown = texts(root);
  expect(shown).toContain('Readings');
  expect(shown).toContain('Read differently across the rewayat');
  expect(shown).toContain("Hafs, Shu'bah (Asim)");
  expect(shown).toContain(
    "Al-Bazzi, Qunbul (Ibn Kathir) · Warsh, Qalun (Nafi') · Al-Duri, Al-Susi (Abu Amr)",
  );
  expect(shown).toContain('Differs from Hafs');
  // group texts, then al-Susi's own text (his idgham kabir) on its own line
  const r = mockState.result.status === 'ready' ? mockState.result : null;
  expect(mockReadingTexts.map(p => [p.text, p.rewayah])).toEqual([
    [r?.readings.groups[0].text, 'hafs'],
    [r?.readings.groups[1].text, 'al-bazzi'],
    [r?.readings.groups[1].members[5].ownText, 'al-susi'],
  ]);
  expect(shown).toContain('Al-Susi');
  expect(shown).toContain(
    'Covers 8 rewayat from 4 of the 10 readers. Differences in pronunciation rules, such as madd length, tashil and imala, are not listed.',
  );
});

it('1:4:1 in Arabic', async () => {
  await i18n.changeLanguage('ar');
  mockState.result = ready('1:4', 1);
  const shown = texts(render('1:4', 1, 'hafs'));
  expect(shown).toContain('القراءات');
  expect(shown).toContain('تختلف قراءتها بين الروايات');
  expect(shown).toContain('حفص، شعبة (عاصم)');
  expect(shown).toContain(
    'البزي، قنبل (ابن كثير) · ورش، قالون (نافع) · الدوري، السوسي (أبو عمرو)',
  );
  expect(shown).toContain('تختلف عن حفص');
});

it('marks the group holding the current rewayah, Hafs first whatever it is', () => {
  mockState.result = ready('1:4', 1);
  let root = render('1:4', 1, 'warsh');
  let rows = labels(root).filter(l => l.includes('read by'));
  expect(rows[0]).toMatch(/^.+, read by Hafs, Shu'bah \(Asim\)$/);
  expect(rows[1]).toMatch(/including the current rewayah$/);
  expect(texts(root).filter(s => s === 'Current')).toHaveLength(1);

  act(() => renderer?.unmount());
  mockReadingTexts.length = 0;
  root = render('1:4', 1, 'hafs');
  rows = labels(root).filter(l => l.includes('read by'));
  expect(rows[0]).toMatch(/including the current rewayah$/);
  expect(rows[1]).not.toMatch(/current/);
});

it('57:24:10: Warsh and Qalun do not read the word', () => {
  mockState.result = ready('57:24', 10);
  const root = render('57:24', 10, 'warsh');
  const shown = texts(root);
  expect(shown).toContain('Not read');
  expect(shown).toContain("Warsh, Qalun (Nafi')");
  expect(labels(root)).toContain("Not read by Warsh, Qalun (Nafi')");
  // only the Hafs group's text is drawn
  expect(mockReadingTexts).toHaveLength(1);
});

it('notes a span, verse ends, the basmala, and joined or apart words', () => {
  mockState.result = ready('40:26', 14);
  expect(texts(render('40:26', 14, 'hafs'))).toContain(
    'Read together with the previous word',
  );
  act(() => renderer?.unmount());

  mockState.result = ready('1:7', 4);
  let shown = texts(render('1:7', 4, 'hafs'));
  expect(shown).toContain(
    'Verse 6 ends after this word in Warsh, Qalun, Al-Duri (Abu Amr), Al-Susi',
  );
  expect(shown).toContain(
    'Read the same way in all 8 rewayat; silah in Al-Bazzi, Qunbul',
  );
  // the silah of al-Bazzi and Qunbul is coloured on their own lines
  expect(
    mockReadingTexts.filter(p => p.silahChars?.length).map(p => p.rewayah),
  ).toEqual(['al-bazzi', 'qunbul']);
  act(() => renderer?.unmount());

  mockState.result = ready('1:1', 1);
  shown = texts(render('1:1', 1, 'hafs'));
  expect(shown).toContain(
    'Bismillah is not counted as a verse of al-Fatiha in Warsh, Qalun, Al-Duri (Abu Amr), Al-Susi',
  );
  act(() => renderer?.unmount());

  mockState.result = ready('15:7', 1);
  shown = texts(render('15:7', 1, 'hafs'));
  expect(shown).toContain('Read together with the next word');
  expect(shown.some(s => s.startsWith('Written as one word in'))).toBe(true);
  act(() => renderer?.unmount());

  mockState.result = ready('72:16', 1);
  shown = texts(render('72:16', 1, 'hafs'));
  expect(shown).toContain(
    'Written as two words in Warsh, Qalun, Al-Duri (Abu Amr), Al-Susi',
  );
});

it('shows no note for a suspected misprint, which is read with its sibling', () => {
  mockState.result = ready('17:62', 1);
  const shown = texts(render('17:62', 1, 'qalun'));
  expect(shown).toContain('Read the same way in all 8 rewayat');
  expect(shown.some(s => /misprint|KFGQPC text/.test(s))).toBe(false);
  expect(shown.filter(s => s === 'Current')).toHaveLength(1);
});

it('a word with no row reads alike; the current rewayah shows its own spelling', () => {
  mockState.result = {
    status: 'ready',
    readings: {
      verseKey: '2:2',
      positions: [3],
      hafsText: null,
      groups: [{kind: 'asHafs', text: '', members: []}],
      alike: true,
      basmalaUnnumberedIn: [],
    },
    dkPositions: [3],
  };
  mockState.currentWords = [
    {text: 'W-TWO', wordPositionInVerse: 2},
    {text: `W-THREE ${VERSE_TWO}`, wordPositionInVerse: 3},
  ];
  let root = render('2:2', 3, 'warsh');
  expect(texts(root)).toContain('Read the same way in all 8 rewayat');
  expect(mockReadingTexts.map(p => [p.text, p.rewayah])).toEqual([
    ['W-THREE', 'warsh'],
  ]);
  expect(texts(root)).toContain('Current');

  act(() => renderer?.unmount());
  mockReadingTexts.length = 0;
  root = render('2:2', 3, 'hafs');
  expect(mockReadingTexts).toEqual([]);
  expect(texts(root)).not.toContain('Current');
});

it('says when the current rewayah is not one of the 8', () => {
  mockState.result = ready('1:4', 1);
  const shown = texts(render('1:4', 1, 'hisham'));
  expect(shown).toContain('Hisham is not one of the 8 rewayat covered');
  expect(shown).not.toContain('Current');
});

it('shows a spinner while loading, and an error with a 44pt retry', () => {
  let root = render('1:4', 1, 'hafs');
  expect(
    root.findAll(n => (n.type as unknown) === ActivityIndicator),
  ).toHaveLength(1);
  act(() => renderer?.unmount());

  const retry = jest.fn();
  mockState.result = {status: 'error', retry};
  root = render('1:4', 1, 'hafs');
  expect(texts(root)).toContain("Couldn't load the readings.");
  const button = root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.style === 'function',
  )[0];
  const style = [button.props.style({pressed: false})].flat();
  expect(Object.assign({}, ...style)).toMatchObject({
    minHeight: 44,
    minWidth: 44,
  });
  act(() => button.props.onPress());
  expect(retry).toHaveBeenCalledTimes(1);
  expect(texts(root)).toContain('Try again');
});

it('never puts Quran text in a Text node', async () => {
  for (const lang of ['en', 'ar']) {
    await i18n.changeLanguage(lang);
    for (const [verseKey, position] of [
      ['1:4', 1],
      ['1:7', 4],
      ['57:24', 10],
      ['40:26', 13],
      ['3:66', 1],
    ] as const) {
      mockReadingTexts.length = 0;
      mockState.result = ready(verseKey, position);
      const shown = texts(render(verseKey, position, 'warsh')).join('\n');
      const r = mockState.result.status === 'ready' ? mockState.result : null;
      const quran = (r?.readings.groups ?? []).flatMap(g => [
        g.text,
        ...g.members.map(m => m.ownText ?? ''),
      ]);
      for (const text of quran.filter(Boolean)) {
        expect(shown.includes(text)).toBe(false);
      }
      expect(mockReadingTexts.length).toBeGreaterThan(0);
      act(() => renderer?.unmount());
    }
  }
});
