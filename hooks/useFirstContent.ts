// @ai-generated
// A reader surface reports its first content once (RFC-023 step 5).
import {useLayoutEffect, useRef} from 'react';

/**
 * Calls `onFirstContent` once, in the commit that first has `hasContent` true.
 * A layout effect runs in that commit, so the splash can go at the first
 * content, also when the next pages' builds hold the JS thread.
 */
export function useFirstContent(
  hasContent: boolean,
  onFirstContent?: () => void,
): void {
  const reportedRef = useRef(false);
  useLayoutEffect(() => {
    if (!hasContent || reportedRef.current) return;
    reportedRef.current = true;
    onFirstContent?.();
  }, [hasContent, onFirstContent]);
}
