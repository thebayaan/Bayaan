/**
 * The crash on return from a background listen on Android. The closed player
 * stays mounted, so when a surah starts in the background its verse rows
 * mount, and when the next one starts they unmount, still in the background.
 * Fabric has not created their Skia views yet: it creates them in the first
 * frame after the return, and React Native Skia then draws each row's
 * recording, which reads the row's paragraphs. They must still be alive.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {AppState, Platform, type AppStateStatus} from 'react-native';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

const mockParagraphs: Array<{dispose: jest.Mock}> = [];
const mockUiQueue: Array<() => void> = [];

jest.mock('react-native-worklets', () => ({
  runOnUIAsync: () =>
    new Promise<void>(resolve => {
      mockUiQueue.push(resolve);
    }),
}));

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Group: () => null,
  RoundedRect: () => null,
  Skia: {
    Color: (c: string) => c,
    ParagraphBuilder: {
      Make: () => ({
        pushStyle: () => undefined,
        pop: () => undefined,
        addText: () => undefined,
        build: () => {
          const paragraph = {
            layout: () => undefined,
            getHeight: () => 10,
            getRectsForRange: () => [],
            dispose: jest.fn(),
          };
          mockParagraphs.push(paragraph);
          return paragraph;
        },
      }),
    },
  },
  TextHeightBehavior: {DisableAll: 0},
  TextDirection: {RTL: 0},
}));

jest.mock('@/utils/skiaTextWeight', () => ({
  createTextStrokePaint: () => undefined,
  getArabicTextWeightStrokeWidth: () => 0,
}));

jest.mock('@/hooks/useRewayahWords', () => ({
  useRewayahWords: (verseKey: string | null) => ({
    words: verseKey ? [{text: 'w', verseKey, wordPositionInVerse: 1}] : [],
    status: 'ready',
  }),
}));

jest.mock('@/services/mushaf/AllahNameHighlightService', () => ({
  getTextAllahNameCharMap: () => null,
}));

jest.mock('../verseOverlays', () => ({
  computeVerseCharRuleMap: () => null,
  computeVerseDiffRanges: () => [],
}));

import SkiaVerseText from '../SkiaVerseText';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const addEventListener = AppState.addEventListener as jest.Mock;
const appState = AppState as unknown as {currentState: AppStateStatus};

/** What React Native does on a change: the state first, then the listeners. */
function changeAppState(next: AppStateStatus) {
  appState.currentState = next;
  addEventListener.mock.calls
    .filter(([type]) => type === 'change')
    .forEach(([, listener]) => listener(next));
}

let nextFrame: FrameRequestCallback[] = [];

/** One frame: the callbacks requested before it. Ones they request wait. */
function runFrame() {
  const due = nextFrame;
  nextFrame = [];
  due.forEach(callback => callback(0));
}

/** The UI thread runs every queued barrier, then the JS side settles. */
async function drainUiQueue() {
  mockUiQueue.splice(0).forEach(run => run());
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

/** A verse row's text, mounted and then unmounted (the next surah). */
function mountAndUnmountRow(verseKey: string) {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <SkiaVerseText
        verseKey={verseKey}
        rewayah="hafs"
        fontMgr={{} as SkTypefaceFontProvider}
        fontFamily="DigitalKhattV2"
        fontSize={24}
        textColor="#111111"
        showTajweed={false}
        width={320}
        indexedTajweedData={null}
      />,
    );
  });
  act(() => renderer?.unmount());
}

beforeEach(() => {
  mockParagraphs.length = 0;
  nextFrame = [];
  jest.replaceProperty(Platform, 'OS', 'android');
  jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(callback => nextFrame.push(callback));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SkiaVerseText paragraphs and the Android background', () => {
  it('keeps the paragraphs of a row that came and went in the background until two frames after the return', async () => {
    changeAppState('background');

    mountAndUnmountRow('109:1');
    expect(mockParagraphs).toHaveLength(1);
    const [paragraph] = mockParagraphs;
    await drainUiQueue();
    expect(paragraph.dispose).not.toHaveBeenCalled();

    changeAppState('active');
    runFrame();
    await drainUiQueue();
    expect(paragraph.dispose).not.toHaveBeenCalled();

    runFrame();
    await drainUiQueue();
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes the paragraphs of a row unmounted in the foreground behind the UI queue, as before', async () => {
    changeAppState('active');

    mountAndUnmountRow('110:1');
    const [paragraph] = mockParagraphs;
    expect(paragraph.dispose).not.toHaveBeenCalled();

    await drainUiQueue();
    expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  });
});
