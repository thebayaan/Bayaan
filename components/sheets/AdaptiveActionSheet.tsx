// @ai-generated
import React, {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaInsetsContext,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
// eslint-disable-next-line no-restricted-imports -- this is the wrapper
import ActionSheet, {
  type ActionSheetProps,
  type ActionSheetRef,
} from 'react-native-actions-sheet';
import {useResponsive} from '@/hooks/useResponsive';
import {getRecentTouch, type TouchPoint} from '@/utils/lastTouch';
import {appLayoutDirection, forceLTR} from '@/utils/rtl';
// @ai-start
import {
  useNativeSheetId,
  useNativeSheetLevel,
} from '@/components/native/nativeSheetContext';
import {fitNativeSheet} from '@/components/native/nativeSheets';
// @ai-end

/** Widest a sheet gets on iPad (ipad-standards §5.3, sheets and dialogs). */
export const SHEET_MAX_WIDTH = 560;
/** Width of a sheet shown as a menu beside its button on iPad. */
export const MENU_WIDTH = 340;
/** Tallest a sheet gets on iPad; taller content scrolls inside it. */
export const SHEET_MAX_HEIGHT = 760;
/** Closest an iPad sheet comes to the window edges. */
const EDGE_MARGIN = 24;
/**
 * Space between a tap and the menu it opened. The tap lands somewhere on
 * the button, so this keeps the menu clear of a 44pt button tapped near its
 * middle instead of covering it.
 */
const ANCHOR_CLEARANCE = 24;
/** Phone sheets reserve this space for the drag handle and home indicator. */
const CARD_TOP_PADDING = 12;
const CARD_BOTTOM_PADDING = 16;
/** Menus end on their content's own bottom padding, like a popover. */
const MENU_BOTTOM_PADDING = 0;
const DEFAULT_RADIUS = 20;
/** Menus dim the screen less than cards, like an iPad popover. */
const MENU_OVERLAY_OPACITY = 0.12;

/**
 * How a sheet shows on iPad. `card` centers it over the screen like a form
 * sheet. `menu` floats it beside the tap that opened it, for short action
 * lists. Phones always get the bottom sheet.
 */
export type TabletPresentation = 'card' | 'menu';

export interface AdaptiveActionSheetProps extends ActionSheetProps {
  tabletPresentation?: TabletPresentation;
}

interface Size {
  width: number;
  height: number;
}

/** Width a sheet is drawn at for this window. */
export function getSheetWidth(windowWidth: number, isTablet: boolean): number {
  return isTablet ? Math.min(windowWidth, SHEET_MAX_WIDTH) : windowWidth;
}

/** Live width of a sheet, for content laid out from it (HTML, grids). */
export function useSheetWidth(): number {
  const {width, isTablet} = useResponsive();
  return getSheetWidth(width, isTablet);
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * Top-left corner for a menu opened by a tap at `anchor`. A tap in the outer
 * thirds opens it away from the nearer side edge; a tap in the middle third
 * (a wide button or row) centers it under the tap, so it does not spill
 * over a sidebar. It opens below the tap when it fits and above it
 * otherwise, and never closer than `EDGE_MARGIN` to the edges of `area`.
 */
export function placeMenu(
  anchor: TouchPoint,
  menu: Size,
  area: Size,
): TouchPoint {
  const third = area.width / 3;
  const x =
    anchor.x < third
      ? anchor.x
      : anchor.x > 2 * third
        ? anchor.x - menu.width
        : anchor.x - menu.width / 2;
  const fitsBelow =
    anchor.y + ANCHOR_CLEARANCE + menu.height <= area.height - EDGE_MARGIN;
  const y = fitsBelow
    ? anchor.y + ANCHOR_CLEARANCE
    : anchor.y - ANCHOR_CLEARANCE - menu.height;
  return {
    x: clamp(x, EDGE_MARGIN, area.width - menu.width - EDGE_MARGIN),
    y: clamp(y, EDGE_MARGIN, area.height - menu.height - EDGE_MARGIN),
  };
}

/** Keeps taps on the card from reaching the layer, which closes the sheet. */
const claimTouch = () => true;

const extraPadding = (base: unknown, extra: number) =>
  typeof base === 'number' ? base + extra : extra;

/**
 * Turns a phone sheet style (rounded and bordered on top only, padded for
 * the drag handle and home indicator) into a floating card's.
 */
export function toCardStyle(
  style: StyleProp<ViewStyle>,
  bottomPadding: number = CARD_BOTTOM_PADDING,
): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const radius =
    flat.borderTopLeftRadius ?? flat.borderRadius ?? DEFAULT_RADIUS;
  const border = flat.borderTopWidth ?? flat.borderWidth;
  return {
    ...flat,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
    ...(border != null && {borderBottomWidth: border}),
    paddingTop: extraPadding(
      flat.paddingTop ?? flat.paddingVertical ?? flat.padding,
      CARD_TOP_PADDING,
    ),
    paddingBottom: extraPadding(
      flat.paddingBottom ?? flat.paddingVertical ?? flat.padding,
      bottomPadding,
    ),
  };
}

interface OpenMenu {
  /** Hides the menu from view while it stays open. */
  cover: () => void;
  hide: () => void;
}

/**
 * iPad menus showing now. A sheet that opens over a menu covers it and
 * closes it once the sheet itself closes, so choosing an item that opens
 * another sheet looks like an iPad menu closing as the sheet appears. The
 * menu cannot close right away: a sheet shown from inside another sheet
 * renders in that sheet's nested provider and would close along with it.
 */
const openMenus = new Set<OpenMenu>();

type TabletSheetProps = Omit<AdaptiveActionSheetProps, 'tabletPresentation'> & {
  presentation: TabletPresentation;
};

/**
 * The library sheet slides up a transparent, full-height layer, and the
 * sheet's own content sits on a card inside it. Tapping the layer around the
 * card closes the sheet, as tapping the backdrop does on phones.
 */
const TabletSheet = forwardRef<ActionSheetRef, TabletSheetProps>(
  ({presentation, containerStyle, children, ...props}, ref) => {
    // The library sheet reads the same context; read it softly so a sheet
    // rendered without a provider (tests) still draws.
    const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;
    const sheetRef = useRef<ActionSheetRef | null>(null);
    const setRef = useCallback(
      (instance: ActionSheetRef | null) => {
        sheetRef.current = instance;
        if (typeof ref === 'function') {
          ref(instance);
        } else if (ref) {
          ref.current = instance;
        }
      },
      [ref],
    );
    // The sheet mounts when it is shown, so this is the tap that showed it.
    const [touch] = useState(getRecentTouch);
    const [area, setArea] = useState<Size | null>(null);
    const [menu, setMenu] = useState<Size | null>(null);
    const [covered, setCovered] = useState(false);
    const asMenu = presentation === 'menu' && touch !== null;

    useEffect(() => {
      // Only the first sheet over a menu owns it, so a sheet stacked on top
      // of that one does not close the menu early when it closes.
      const coveredMenus = [...openMenus];
      coveredMenus.forEach(openMenu => {
        openMenus.delete(openMenu);
        openMenu.cover();
      });
      return () => coveredMenus.forEach(openMenu => openMenu.hide());
    }, []);
    useEffect(() => {
      if (!asMenu) {
        return;
      }
      const openMenu: OpenMenu = {
        cover: () => setCovered(true),
        hide: () => sheetRef.current?.hide(),
      };
      openMenus.add(openMenu);
      return () => {
        openMenus.delete(openMenu);
      };
    }, [asMenu]);

    const {closable, closeOnTouchBackdrop, onTouchBackdrop} = props;
    const handleBackdropPress = useCallback(
      (event: GestureResponderEvent) => {
        onTouchBackdrop?.(event);
        if (closable !== false && closeOnTouchBackdrop !== false) {
          sheetRef.current?.hide();
        }
      },
      [closable, closeOnTouchBackdrop, onTouchBackdrop],
    );
    const handleAreaLayout = useCallback((event: LayoutChangeEvent) => {
      const {width, height} = event.nativeEvent.layout;
      setArea({width, height});
    }, []);
    const handleMenuLayout = useCallback((event: LayoutChangeEvent) => {
      const {width, height} = event.nativeEvent.layout;
      setMenu({width, height});
    }, []);

    const maxHeight = Math.min(
      (area?.height ?? SHEET_MAX_HEIGHT) - 2 * EDGE_MARGIN,
      SHEET_MAX_HEIGHT,
    );
    // The layer starts below the status bar; touches are in window points.
    const menuOrigin =
      asMenu && area && menu
        ? placeMenu({x: touch.x, y: touch.y - topInset}, menu, area)
        : null;

    return (
      <ActionSheet
        ref={setRef}
        {...props}
        containerStyle={styles.layer}
        gestureEnabled={false}
        disableElevation={true}
        overdrawEnabled={false}
        useBottomSafeAreaPadding={false}
        drawUnderStatusBar={false}
        animated={asMenu ? false : props.animated}
        defaultOverlayOpacity={
          asMenu ? MENU_OVERLAY_OPACITY : props.defaultOverlayOpacity
        }
        overlayColor={covered ? 'transparent' : props.overlayColor}>
        <Pressable
          accessible={false}
          onLayout={handleAreaLayout}
          onPress={handleBackdropPress}
          style={[styles.area, forceLTR, !asMenu && styles.centered]}>
          <View
            onLayout={asMenu ? handleMenuLayout : undefined}
            onStartShouldSetResponder={claimTouch}
            pointerEvents={covered ? 'none' : 'auto'}
            accessibilityElementsHidden={covered}
            importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
            style={[
              toCardStyle(
                containerStyle,
                asMenu ? MENU_BOTTOM_PADDING : CARD_BOTTOM_PADDING,
              ),
              styles.shadow,
              appLayoutDirection,
              asMenu
                ? [
                    styles.menu,
                    menuOrigin
                      ? {left: menuOrigin.x, top: menuOrigin.y}
                      : styles.measuring,
                  ]
                : styles.card,
              {maxHeight},
              covered && styles.covered,
            ]}>
            {children}
          </View>
        </Pressable>
      </ActionSheet>
    );
  },
);
TabletSheet.displayName = 'TabletSheet';

// @ai-start
/**
 * A sheet's content inside a native sheet (`showSheet`): the native sheet
 * draws the background, grabber and corners, so the content only fills it.
 * `onOpen` and `onClose` still run, on mount and when the sheet is gone.
 */
function NativeSheetBody({
  onOpen,
  onClose,
  children,
}: Pick<ActionSheetProps, 'onOpen' | 'onClose' | 'children'>) {
  const callbacks = useRef({onOpen, onClose});
  callbacks.current = {onOpen, onClose};
  useEffect(() => {
    callbacks.current.onOpen?.();
    return () => callbacks.current.onClose?.();
  }, []);
  const level = useNativeSheetLevel();
  const {height: windowHeight} = useWindowDimensions();
  if (!level?.fit) return <View style={styles.nativeBody}>{children}</View>;

  // A fitted sheet is as tall as its content (which clears the home
  // indicator itself) plus the space above it; past the large height its
  // content scrolls.
  const insets = initialWindowMetrics?.insets;
  const chrome = NATIVE_BODY_TOP;
  const maxHeight = windowHeight - (insets?.top ?? 0) - LARGE_DETENT_GAP;
  const onLayout = (event: LayoutChangeEvent) =>
    fitNativeSheet(
      level.key,
      event.nativeEvent.layout.height + chrome,
      maxHeight,
    );
  return (
    <ScrollView
      style={styles.nativeScroll}
      contentContainerStyle={styles.nativeFitBody}
      bounces={false}
      showsVerticalScrollIndicator={false}>
      <View onLayout={onLayout}>{children}</View>
    </ScrollView>
  );
}

/** Space between the native grabber and the content. */
const NATIVE_BODY_TOP = 18;
/** The large detent stops this far below the status bar. */
const LARGE_DETENT_GAP = 10;
// @ai-end

/**
 * `ActionSheet` that phones get unchanged. On iPad it never spans the
 * window: it shows as a centered card at most `SHEET_MAX_WIDTH` wide, or as
 * a menu beside its button when `tabletPresentation` is `menu`. Inside a
 * native sheet it draws only its content.
 */
const AdaptiveActionSheet = forwardRef<
  ActionSheetRef,
  AdaptiveActionSheetProps
>(({tabletPresentation = 'card', ...props}, ref) => {
  const {isTablet} = useResponsive();
  const nativeSheetId = useNativeSheetId(); // @ai
  if (nativeSheetId) {
    return (
      <NativeSheetBody onOpen={props.onOpen} onClose={props.onClose}>
        {props.children}
      </NativeSheetBody>
    );
  }
  if (isTablet) {
    return (
      <TabletSheet ref={ref} presentation={tabletPresentation} {...props} />
    );
  }
  return <ActionSheet ref={ref} {...props} />;
});
AdaptiveActionSheet.displayName = 'AdaptiveActionSheet';

export default AdaptiveActionSheet;

const styles = StyleSheet.create({
  // @ai: below the native grabber
  nativeBody: {flex: 1, paddingTop: NATIVE_BODY_TOP},
  nativeFitBody: {flexGrow: 1, paddingTop: NATIVE_BODY_TOP},
  nativeScroll: {flex: 1},
  layer: {
    height: '100%',
    backgroundColor: 'transparent',
  },
  area: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: EDGE_MARGIN,
  },
  card: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
  },
  measuring: {
    opacity: 0,
  },
  covered: {
    opacity: 0,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
});
