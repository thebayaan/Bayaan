import React, {createContext, useContext, useEffect, useRef} from 'react';
import {
  Platform,
  StyleSheet,
  TVFocusGuideView,
  type NativeSyntheticEvent,
} from 'react-native';
import {setScreenFocusRestore} from '../../services/focusReturn';
import {
  createFocusMemory,
  focusInSteps,
  landedSince,
  requestFocus,
} from '../../services/layerFocus';

const ScreenActiveContext = createContext(true);

/**
 * False while a screen is covered by a stacked screen (kept mounted, hidden).
 * Anything that listens to the remote directly (useTVEventHandler) should do
 * nothing while it is false, so a hidden screen never acts on a key.
 */
export function useScreenActive(): boolean {
  return useContext(ScreenActiveContext);
}

/**
 * How a covered layer is hidden. display 'none' takes it out of both focus
 * engines, but on tvOS Fabric marks such a view Hidden and deletes its whole
 * native subtree (Android keeps it): uncovering then builds fresh views, so
 * the autoFocus guide's memory, list cells, scroll offsets and the focused
 * element itself are gone, and every hasTVPreferredFocus fires again. On
 * tvOS a covered layer stays laid out instead, invisible, and unfocusable
 * through its guide (focusable false turns off user interaction for the
 * subtree, which UIKit's focus engine skips).
 */
const HIDE_WITH_DISPLAY = Platform.OS !== 'ios';

/** Bubbling focus and blur events; `target` is the focused host view. */
type FocusEvent = NativeSyntheticEvent<unknown> & {target?: unknown};

type Props = {
  active: boolean;
  /**
   * What the layer shows (the root place's tab). When it changed while the
   * layer was covered, there is nothing to go back to: the new screen's own
   * first focus stands.
   */
  contentKey?: string;
  /**
   * The last resort when neither the remembered element nor the layer's
   * guide takes focus back (the root place: its sidebar item), so focus
   * never ends up nowhere. False when it had nothing to focus.
   */
  fallback?: () => boolean;
  children: React.ReactNode;
};

/**
 * One screen of the navigation stack (or the root place under it). Covered
 * layers stay mounted, hidden (see HIDE_WITH_DISPLAY), keeping their state,
 * scroll offsets and focus.
 *
 * The layer notes the element focused last inside it (focus events bubble up
 * to its guide). When the layer is uncovered, focus is asked back onto that
 * element: the card, row, key or sidebar tile that was pressed, not the
 * screen's first item. The layer is also an autoFocus guide, whose native
 * memory is the next try, then `fallback`; each try is checked (focusInSteps)
 * before the next, so a request either engine drops never leaves the screen
 * with nothing focused and the remote dead.
 */
export function ScreenLayer({
  active,
  contentKey,
  fallback,
  children,
}: Props): React.ReactElement {
  const guide = useRef<unknown>(null);
  const memory = useRef(createFocusMemory()).current;
  // The content the layer showed when it was covered, if it was.
  const coveredWith = useRef<{key: string | undefined} | null>(null);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    if (!active) {
      coveredWith.current ??= {key: contentKey};
      return;
    }
    let stop: (() => void) | null = null;
    const restore = (): void => {
      stop?.();
      stop = focusInSteps(
        [
          () => requestFocus(memory.last()),
          () => requestFocus(guide.current),
          () => fallbackRef.current?.() ?? false,
        ],
        landedSince(memory),
      );
    };
    const unregister = setScreenFocusRestore(restore);
    let frame: number | null = null;
    const covered = coveredWith.current;
    coveredWith.current = null;
    if (covered && covered.key === contentKey) {
      // After the frame that shows the layer again: neither engine can focus
      // a view that is still hidden.
      frame = requestAnimationFrame(() => {
        frame = null;
        restore();
      });
    }
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      stop?.();
      unregister();
    };
  }, [active, contentKey, memory]);

  return (
    <ScreenActiveContext.Provider value={active}>
      <TVFocusGuideView
        ref={node => {
          guide.current = node;
        }}
        autoFocus
        // `enabled` is the guide's display: 'none' while covered (a display
        // in `style` would be overridden by it).
        enabled={HIDE_WITH_DISPLAY ? active : true}
        focusable={HIDE_WITH_DISPLAY ? undefined : active}
        pointerEvents={active ? 'auto' : 'none'}
        onFocus={(e: FocusEvent) => memory.focus(e.target)}
        onBlur={(e: FocusEvent) => memory.blur(e.target)}
        style={[
          StyleSheet.absoluteFill,
          !HIDE_WITH_DISPLAY && !active && styles.covered,
        ]}>
        {children}
      </TVFocusGuideView>
    </ScreenActiveContext.Provider>
  );
}

const styles = StyleSheet.create({
  covered: {opacity: 0},
});
