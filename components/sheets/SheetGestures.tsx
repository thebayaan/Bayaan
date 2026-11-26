import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  type FlatList as RNFlatList,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import {
  GestureDetector,
  LegacyFlatList,
  LegacyScrollView,
  NativeViewGestureHandler,
  useLongPressGesture,
} from 'react-native-gesture-handler';
// The sheet's drag gesture. The package reads it from this context for its
// own ScrollView and FlatList but does not export it.
import {usePanGestureContext} from 'react-native-actions-sheet/dist/src/context';

// How sheet content shares touches with the sheet's drag-to-close gesture.
//
// The ScrollView and FlatList that react-native-actions-sheet exports pass
// `simultaneousHandlers` to Gesture Handler's ScrollView, which Gesture
// Handler 3 no longer reads. The sheet's drag and the scroll view then
// compete for every touch, and the drag (it starts after 5pt) usually wins:
// content barely scrolls, and a drag meant to scroll moves or closes the
// sheet. React Native's own ScrollView and FlatList compete the same way.
//
// Sheet content scrolls with `SheetScrollView` and `SheetFlatList` instead:
// - Scrolled to the top, the scroll view and the drag run together. A drag
//   down moves the sheet (the content cannot scroll past its top), a drag
//   up scrolls the content.
// - Scrolled down, the drag waits for the scroll view, so the touch only
//   scrolls and never moves or closes the sheet.
// Touches that start outside scroll views (the handle, a header) always
// drag the sheet.
//
// The drag starts after 5pt of vertical movement anywhere on the sheet and,
// when it starts, cancels the press under the finger, so a tap that moves
// 5pt is lost. `SheetFooter` holds the buttons a sheet ends with (Play,
// Start, Done, Save) and claims their touches, so a tap on them that
// wobbles is still a tap. `SheetNoDrag` keeps the drag off a list that
// scrolls by itself inside a sheet.
//
// The sheet itself must not stretch up while content scrolls, so phone
// sheets turn off its overdraw (see AdaptiveActionSheet).

/** A scroll offset this close to 0 counts as scrolled to the top. */
export const TOP_SLOP = 1;
/** Milliseconds between scroll events: one a frame, to see the top in time. */
const SCROLL_EVENT_THROTTLE = 16;

interface SheetDrag {
  /** Ref the sheet keeps its drag gesture in. */
  ref: React.RefObject<unknown>;
  /** The drag gesture's handler tag, or undefined outside a sheet. */
  tag: number | undefined;
}

function readHandlerTag(ref: React.RefObject<unknown>): number | undefined {
  const tag = (ref.current as {handlerTag?: unknown} | null | undefined)
    ?.handlerTag;
  return typeof tag === 'number' && tag > 0 ? tag : undefined;
}

/**
 * The sheet's drag gesture. The sheet creates it after its content has
 * mounted, so the tag is read after each render rather than during one.
 */
function useSheetDrag(): SheetDrag {
  const {ref} = usePanGestureContext();
  const [tag, setTag] = useState<number | undefined>(undefined);
  // Runs after every render, as the ref can change without causing one. It
  // sets the tag only when it differs, so it never sets it twice in a row.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const current = readHandlerTag(ref);
    if (current !== tag) {
      setTag(current);
    }
  });
  return {ref, tag};
}

/**
 * Gesture Handler turns `simultaneousHandlers` refs into tags, but sends
 * `blocksHandlers` to the native side as given, so it takes the tag itself.
 */
function blocking(tag: number | undefined): React.Ref<unknown>[] {
  return (tag === undefined ? [] : [tag]) as unknown as React.Ref<unknown>[];
}

/** Relations of a vertical scroll view with the sheet's drag. */
function scrollRelations(drag: SheetDrag, atTop: boolean) {
  if (drag.tag === undefined) {
    return {simultaneousHandlers: [], blocksHandlers: blocking(undefined)};
  }
  return atTop
    ? {simultaneousHandlers: [drag.ref], blocksHandlers: blocking(undefined)}
    : {simultaneousHandlers: [], blocksHandlers: blocking(drag.tag)};
}

type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

/** Whether the content is scrolled to its top, kept from scroll events. */
function useAtTop(onScroll: ScrollHandler | undefined) {
  const [atTop, setAtTop] = useState(true);
  const atTopRef = useRef(true);
  const handleScroll: ScrollHandler = event => {
    const top = event.nativeEvent.contentOffset.y <= TOP_SLOP;
    if (top !== atTopRef.current) {
      atTopRef.current = top;
      setAtTop(top);
    }
    onScroll?.(event);
  };
  return [atTop, handleScroll] as const;
}

export type SheetScrollViewProps = Omit<ScrollViewProps, 'horizontal'> & {
  ref?: React.Ref<ScrollViewInstance>;
};

/**
 * Vertical ScrollView for sheet content. At the top a drag down moves the
 * sheet, so the content never bounces (iOS) and shows no edge stretch there
 * (Android) to be pulled down along with it.
 */
export function SheetScrollView({
  ref,
  onScroll,
  overScrollMode,
  scrollEventThrottle = SCROLL_EVENT_THROTTLE,
  ...props
}: SheetScrollViewProps) {
  const drag = useSheetDrag();
  const [atTop, handleScroll] = useAtTop(onScroll);
  return (
    <LegacyScrollView
      {...props}
      ref={ref}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={handleScroll}
      bounces={false}
      overScrollMode={atTop ? 'never' : overScrollMode}
      {...scrollRelations(drag, atTop)}
    />
  );
}

export type SheetFlatListProps<ItemT> = Omit<
  FlatListProps<ItemT>,
  'horizontal' | 'renderScrollComponent'
> & {
  ref?: React.Ref<RNFlatList<ItemT>>;
};

/** Vertical FlatList for sheet content, as `SheetScrollView`. */
export function SheetFlatList<ItemT>({
  ref,
  onScroll,
  overScrollMode,
  scrollEventThrottle = SCROLL_EVENT_THROTTLE,
  ...props
}: SheetFlatListProps<ItemT>) {
  const drag = useSheetDrag();
  const [atTop, handleScroll] = useAtTop(onScroll);
  return (
    <LegacyFlatList<ItemT>
      {...props}
      ref={ref}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={handleScroll}
      bounces={false}
      overScrollMode={atTop ? 'never' : overScrollMode}
      {...scrollRelations(drag, atTop)}
    />
  );
}

/**
 * A list that scrolls by itself inside a sheet (one in React Native's own
 * ScrollView, nested in the sheet's). The sheet's drag waits for its
 * touches to end, so the list scrolls in either direction and a drag on it
 * never moves the sheet.
 *
 * Not for buttons: the drag only waits until the finger lifts, so on iOS
 * a tap that moved 5pt may start it then, and starting cancels the press.
 * Buttons go in a `SheetFooter`.
 */
export function SheetNoDrag({children, ...props}: ViewProps) {
  const drag = useSheetDrag();
  return (
    <NativeViewGestureHandler blocksHandlers={blocking(drag.tag)}>
      <View {...props}>{children}</View>
    </NativeViewGestureHandler>
  );
}

/**
 * The footer's claim: active as the finger lands (no hold time), held
 * however far the finger moves, and never cancelling the presses under it.
 * A gesture that is active stops the sheet's drag from starting for that
 * touch (UIKit and Gesture Handler's Android orchestrator alike).
 */
export const FOOTER_CLAIM = {
  minDuration: 0,
  maxDistance: 1e6,
  shouldCancelWhenOutside: false,
  cancelsJSResponder: false,
  cancelsTouchesInView: false,
  disableReanimated: true,
} as const;

/**
 * Buttons a sheet ends with: a pinned footer (Play, Start), or the last
 * buttons of its content (Done, Save, Delete). It claims each touch the
 * moment the finger lands, so the sheet never starts a drag from it and a
 * tap that wobbles is still a tap.
 *
 * A drag that starts on it neither moves the sheet nor scrolls a list it
 * sits in, so keep it to those buttons, not the rows of a list. The claim
 * also keeps the touch from native views under it, so it holds Pressables
 * only, never a TextInput, Switch or scroll view.
 */
export function SheetFooter({children, ...props}: ViewProps) {
  const claim = useLongPressGesture(FOOTER_CLAIM);
  return (
    <GestureDetector gesture={claim}>
      <View {...props}>{children}</View>
    </GestureDetector>
  );
}
