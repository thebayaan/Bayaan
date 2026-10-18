import React, {createContext, useContext, useEffect, useRef} from 'react';
import {StyleSheet, TVFocusGuideView} from 'react-native';
import {setScreenFocusRestore} from '../../services/focusReturn';

const ScreenActiveContext = createContext(true);

/**
 * False while a screen is covered by a stacked screen (kept mounted, hidden).
 * Anything that listens to the remote directly (useTVEventHandler) should do
 * nothing while it is false, so a hidden screen never acts on a key.
 */
export function useScreenActive(): boolean {
  return useContext(ScreenActiveContext);
}

type Focusable = {requestTVFocus?: () => void};

type Props = {
  active: boolean;
  /**
   * What the layer shows (the root place's tab). When it changed while the
   * layer was covered, there is nothing to go back to: the new screen's own
   * first focus stands.
   */
  contentKey?: string;
  children: React.ReactNode;
};

/**
 * One screen of the navigation stack (or the root place under it). Covered
 * layers stay mounted with display 'none', which takes them out of both
 * focus engines (UIKit hides the view; Android makes it INVISIBLE) while
 * keeping their state, scroll offsets and native views.
 *
 * The layer is an autoFocus guide, so it remembers its last focused element
 * natively (tvOS: when focus leaves it; Android: on every child focus). When
 * the layer is uncovered, focus is asked back onto that element: the card,
 * row, key or sidebar tile that was pressed, not the screen's first item.
 */
export function ScreenLayer({
  active,
  contentKey,
  children,
}: Props): React.ReactElement {
  const ref = useRef<Focusable | null>(null);
  // The content the layer showed when it was covered, if it was.
  const coveredWith = useRef<{key: string | undefined} | null>(null);

  useEffect(() => {
    if (!active) {
      coveredWith.current ??= {key: contentKey};
      return;
    }
    const restore = (): void => ref.current?.requestTVFocus?.();
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
      unregister();
    };
  }, [active, contentKey]);

  return (
    <ScreenActiveContext.Provider value={active}>
      <TVFocusGuideView
        ref={node => {
          ref.current = node as Focusable | null;
        }}
        autoFocus
        // `enabled` is the guide's display: 'none' while covered (a display
        // in `style` would be overridden by it).
        enabled={active}
        style={StyleSheet.absoluteFill}>
        {children}
      </TVFocusGuideView>
    </ScreenActiveContext.Provider>
  );
}
