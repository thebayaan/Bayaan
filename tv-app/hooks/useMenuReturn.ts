import {useEffect, useRef, useState} from 'react';
import {
  useContextMenuStore,
  type SurahMenuOrigin,
} from '../store/contextMenuStore';

/** How long the opener keeps preferred focus after the menu closes. */
const RETURN_MS = 1500;

/**
 * True for a moment after a surah menu opened from `origin` closes, so the
 * control that opened it with a plain press (not a long-press, which the
 * menu restores itself) can take focus back with hasTVPreferredFocus.
 */
export function useMenuReturn(origin: SurahMenuOrigin): boolean {
  const open = useContextMenuStore(
    s => s.target?.kind === 'surah' && s.target.origin === origin,
  );
  const [returning, setReturning] = useState<boolean>(false);
  const wasOpen = useRef<boolean>(false);

  useEffect(() => {
    if (wasOpen.current && !open) setReturning(true);
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!returning) return;
    const timer = setTimeout(() => setReturning(false), RETURN_MS);
    return () => clearTimeout(timer);
  }, [returning]);

  return returning;
}
