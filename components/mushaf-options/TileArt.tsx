// @ai-generated
import React, {useMemo} from 'react';
import {StyleSheet, View, type DimensionValue} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {forceLTR} from '@/utils/rtl';
import type {ReadingLayout} from './readingLayout';
import {useLoopClock, useLoopsRunning} from './motion';

/**
 * The pictures inside the View and Layout tiles. Each loops forever without
 * a jump: the swipe strip and the flipping leaf land on a page identical to
 * the one they left, and the rising columns are two identical halves, so
 * the clock wrapping back to 0 draws the same frame. The pictures show a
 * mushaf, which turns its pages the same way in any app language, so they
 * are drawn left to right.
 */

export type TileArtKind = 'mushaf' | 'list' | ReadingLayout;

const S = moderateScale;
const PAGE_W = S(36);
const PAGE_H = S(46);
const STRIP_GAP = S(10);
const STRIP_STEP = PAGE_W + STRIP_GAP;
const STRIP_PAGES = 7;

const SWIPE_MS = 2600;
const FLIP_MS = 2600;
const RISE_MS = 5000;
const GLOW_MS = 1600;

const swipeEase = Easing.bezierFn(0.6, 0, 0.3, 1);
const flipEase = Easing.bezierFn(0.5, 0, 0.3, 1);

interface ArtColors {
  page: string;
  line: string;
  faint: string;
  ink: string;
}

function useArtColors(): ArtColors {
  const {theme} = useTheme();
  return useMemo(
    () => ({
      page: theme.colors.background,
      line: Color(theme.colors.text).alpha(0.38).toString(),
      faint: Color(theme.colors.text).alpha(0.16).toString(),
      ink: theme.colors.text,
    }),
    [theme],
  );
}

export function TileArt({
  kind,
  selected,
}: {
  kind: TileArtKind;
  selected: boolean;
}): React.JSX.Element {
  const colors = useArtColors();
  const running = useLoopsRunning();
  return (
    <View
      style={[styles.fill, forceLTR, !selected && styles.dim]}
      pointerEvents="none">
      {kind === 'mushaf' ? (
        <MushafArt colors={colors} running={running} />
      ) : kind === 'single' || kind === 'pages' ? (
        <SwipeArt colors={colors} running={running} />
      ) : kind === 'book' ? (
        <BookArt colors={colors} running={running} />
      ) : (
        <RiseArt kind={kind} colors={colors} running={running} />
      )}
    </View>
  );
}

interface ArtProps {
  colors: ArtColors;
  running: boolean;
}

/** A page with three full lines and a short one, lines set to the right. */
function PageLines({
  colors,
  count = 4,
  align = 'flex-end',
}: {
  colors: ArtColors;
  count?: number;
  align?: 'flex-end' | 'center';
}): React.JSX.Element {
  return (
    <>
      {Array.from({length: count}, (_, index) => (
        <View
          key={index}
          style={[
            styles.line,
            {
              backgroundColor: colors.line,
              alignSelf: align,
              width: index === count - 1 ? '60%' : '100%',
            },
          ]}
        />
      ))}
    </>
  );
}

/**
 * Single page and Pages: a strip of identical pages shifts one page
 * sideways, holds, then shifts again.
 */
function SwipeArt({colors, running}: ArtProps): React.JSX.Element {
  const clock = useLoopClock(SWIPE_MS, running);
  const strip = useAnimatedStyle(() => {
    const t = clock.value;
    const move = t < 0.4 ? 0 : t < 0.75 ? swipeEase((t - 0.4) / 0.35) : 1;
    return {transform: [{translateX: move * STRIP_STEP}]};
  });
  return (
    <Animated.View style={[styles.strip, strip]}>
      {Array.from({length: STRIP_PAGES}, (_, index) => (
        <View
          key={index}
          style={[
            styles.page,
            {
              width: PAGE_W,
              height: PAGE_H,
              backgroundColor: colors.page,
              borderColor: colors.line,
            },
          ]}>
          <PageLines colors={colors} />
        </View>
      ))}
    </Animated.View>
  );
}

const BOOK_PAGE_W = S(30);
// Scaled here, on the JS thread: the leaf's animated style runs on the UI
// thread, where calling a plain function (moderateScale) is fatal.
const LEAF_PERSPECTIVE = S(200);

/** Book: a leaf flips over the spine onto an identical page. */
function BookArt({colors, running}: ArtProps): React.JSX.Element {
  const clock = useLoopClock(FLIP_MS, running);
  const leaf = useAnimatedStyle(() => {
    const t = clock.value;
    const turn = t < 0.35 ? 0 : t < 0.8 ? flipEase((t - 0.35) / 0.45) : 1;
    return {
      transform: [
        {perspective: LEAF_PERSPECTIVE},
        {rotateY: `${turn * 180}deg`},
      ],
    };
  });
  // Lines are centered so the leaf, drawn mirrored once it has turned,
  // matches the page it lands on.
  const half = (side: 'left' | 'right') => (
    <View
      style={[
        styles.page,
        side === 'left' ? styles.bookLeft : styles.bookRight,
        {backgroundColor: colors.page, borderColor: colors.line},
      ]}>
      <View
        style={[
          styles.spineShade,
          side === 'left' ? styles.spineShadeLeft : styles.spineShadeRight,
          {backgroundColor: colors.faint},
        ]}
      />
      <PageLines colors={colors} count={3} align="center" />
    </View>
  );
  return (
    <View style={styles.book}>
      {half('left')}
      {half('right')}
      <Animated.View style={[styles.leaf, leaf]}>{half('left')}</Animated.View>
    </View>
  );
}

const RISE_ITEM_GAP = S(5);

interface RiseItem {
  kind: 'arabic' | 'translation' | 'page' | 'rule';
  width: DimensionValue;
}

const LIST_HALF: RiseItem[] = [
  {kind: 'arabic', width: '80%'},
  {kind: 'translation', width: '92%'},
  {kind: 'translation', width: '58%'},
  {kind: 'rule', width: '100%'},
  {kind: 'arabic', width: '66%'},
  {kind: 'translation', width: '86%'},
  {kind: 'translation', width: '44%'},
  {kind: 'rule', width: '100%'},
  {kind: 'arabic', width: '74%'},
  {kind: 'translation', width: '90%'},
  {kind: 'translation', width: '52%'},
  {kind: 'rule', width: '100%'},
];

const CONTINUOUS_HALF: RiseItem[] = [
  {kind: 'arabic', width: '100%'},
  {kind: 'translation', width: '84%'},
  {kind: 'arabic', width: '72%'},
  {kind: 'translation', width: '94%'},
  {kind: 'arabic', width: '88%'},
  {kind: 'translation', width: '60%'},
  {kind: 'arabic', width: '100%'},
  {kind: 'translation', width: '78%'},
  {kind: 'arabic', width: '64%'},
  {kind: 'translation', width: '90%'},
];

const SCROLL_HALF: RiseItem[] = [
  {kind: 'page', width: S(44)},
  {kind: 'page', width: S(44)},
  {kind: 'page', width: S(44)},
];

function itemHeight(item: RiseItem): number {
  if (item.kind === 'page') return S(26);
  if (item.kind === 'arabic') return S(5);
  if (item.kind === 'rule') return StyleSheet.hairlineWidth;
  return S(3);
}

function halfHeight(items: RiseItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum + itemHeight(item) + (item.kind === 'page' ? S(4) : RISE_ITEM_GAP),
    0,
  );
}

/**
 * List, Scroll and Continuous: content rises continuously. The column is
 * two identical halves and moves up by one half per loop.
 */
function RiseArt({
  kind,
  colors,
  running,
}: ArtProps & {kind: 'list' | 'scroll' | 'continuous'}): React.JSX.Element {
  const items =
    kind === 'scroll'
      ? SCROLL_HALF
      : kind === 'continuous'
        ? CONTINUOUS_HALF
        : LIST_HALF;
  const shift = halfHeight(items);
  const clock = useLoopClock(RISE_MS, running);
  const column = useAnimatedStyle(() => ({
    transform: [{translateY: -clock.value * shift}],
  }));
  const renderItem = (item: RiseItem, index: number) => {
    if (item.kind === 'page') {
      return (
        <View
          key={index}
          style={[
            styles.page,
            styles.scrollPage,
            {
              width: item.width,
              height: itemHeight(item),
              backgroundColor: colors.page,
              borderColor: colors.line,
            },
          ]}>
          <PageLines colors={colors} count={2} />
        </View>
      );
    }
    return (
      <View
        key={index}
        style={{
          width: item.width,
          height: itemHeight(item),
          marginBottom: RISE_ITEM_GAP,
          borderRadius: S(2),
          alignSelf: item.kind === 'arabic' ? 'flex-end' : 'flex-start',
          backgroundColor: item.kind === 'arabic' ? colors.line : colors.faint,
        }}
      />
    );
  };
  return (
    <Animated.View
      style={[
        styles.rise,
        kind === 'scroll' ? styles.riseCentered : styles.riseText,
        column,
      ]}>
      {items.map(renderItem)}
      {items.map((item, index) => renderItem(item, index + items.length))}
    </Animated.View>
  );
}

const GLOW_PHASES = [0, 0.25, 0.5, 0.75, 0.12];
const GLOW_BAND = S(12);
const MUSHAF_PAGE_W = S(46);
const MUSHAF_LINE_W = MUSHAF_PAGE_W - S(12) - 3;

/** Mushaf: a highlight band runs right to left along the lines. */
function MushafArt({colors, running}: ArtProps): React.JSX.Element {
  const clock = useLoopClock(GLOW_MS, running);
  return (
    <View
      style={[
        styles.page,
        styles.mushafPage,
        {backgroundColor: colors.page, borderColor: colors.line},
      ]}>
      <View style={[styles.surahPill, {borderColor: colors.line}]} />
      {GLOW_PHASES.map((phase, index) => (
        <GlowLine
          key={index}
          clock={clock}
          phase={phase}
          width={
            index === GLOW_PHASES.length - 1
              ? MUSHAF_LINE_W * 0.6
              : MUSHAF_LINE_W
          }
          colors={colors}
          running={running}
        />
      ))}
    </View>
  );
}

function GlowLine({
  clock,
  phase,
  width,
  colors,
  running,
}: {
  clock: SharedValue<number>;
  phase: number;
  width: number;
  colors: ArtColors;
  running: boolean;
}): React.JSX.Element {
  const band = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1;
    return {
      transform: [{translateX: width - t * (width + GLOW_BAND)}],
    };
  });
  return (
    <View
      style={[
        styles.line,
        styles.glowLine,
        {width, backgroundColor: colors.line},
      ]}>
      {running ? (
        <Animated.View
          style={[styles.glowBand, {backgroundColor: colors.ink}, band]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dim: {
    opacity: 0.75,
  },
  page: {
    borderWidth: 1.5,
    borderRadius: S(4),
    paddingHorizontal: S(5),
    paddingVertical: S(6),
    gap: S(3),
    overflow: 'hidden',
  },
  line: {
    height: 3,
    borderRadius: 2,
  },
  strip: {
    flexDirection: 'row',
    gap: STRIP_GAP,
  },
  book: {
    flexDirection: 'row',
  },
  bookLeft: {
    width: BOOK_PAGE_W,
    height: PAGE_H,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  bookRight: {
    width: BOOK_PAGE_W,
    height: PAGE_H,
    borderLeftWidth: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  spineShade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: S(4),
  },
  spineShadeLeft: {
    right: 0,
  },
  spineShadeRight: {
    left: 0,
  },
  leaf: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BOOK_PAGE_W,
    height: PAGE_H,
    transformOrigin: 'right center',
  },
  rise: {
    position: 'absolute',
    top: S(8),
  },
  riseText: {
    left: S(14),
    right: S(14),
  },
  riseCentered: {
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollPage: {
    marginBottom: S(4),
    paddingVertical: S(4),
  },
  mushafPage: {
    width: MUSHAF_PAGE_W,
    height: S(56),
    borderRadius: S(5),
    paddingHorizontal: S(6),
    paddingVertical: S(8),
    gap: S(5),
    alignItems: 'flex-end',
  },
  surahPill: {
    alignSelf: 'center',
    width: S(22),
    height: S(5),
    borderRadius: S(3),
    borderWidth: 1.2,
  },
  glowLine: {
    overflow: 'hidden',
  },
  glowBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: GLOW_BAND,
    borderRadius: 2,
    opacity: 0.85,
  },
});
