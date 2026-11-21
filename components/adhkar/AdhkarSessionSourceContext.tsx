// components/adhkar/AdhkarSessionSourceContext.tsx
// The list a reader shows, as a SessionSource, so a card's play button can
// start or toggle the session without prop drilling through DhikrReader.
// @ai-start
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
// @ai-end
import type {SessionSource} from '@/services/adhkar/playback/types';

const SourceContext = createContext<SessionSource | null>(null);

// @ai-start
// The dhikr whose Repeat was switched on before they played. Kept beside the
// source, for as long as the reader is open, and not in the card: the pager
// unmounts a page that scrolls away, and the card's own state with it.
interface ArmedRepeat {
  ids: ReadonlySet<string>;
  setArmed: (dhikrId: string, armed: boolean) => void;
}

const ArmedRepeatContext = createContext<ArmedRepeat | null>(null);
const NO_IDS: ReadonlySet<string> = new Set();
// @ai-end

export function AdhkarSessionSourceProvider({
  source,
  children,
}: {
  source: SessionSource | null;
  children: React.ReactNode;
}): React.JSX.Element {
  // @ai-start
  const [ids, setIds] = useState(NO_IDS);
  const setArmed = useCallback((dhikrId: string, armed: boolean) => {
    setIds(prev => {
      if (prev.has(dhikrId) === armed) return prev;
      const next = new Set(prev);
      if (armed) next.add(dhikrId);
      else next.delete(dhikrId);
      return next;
    });
  }, []);
  const armedRepeat = useMemo(() => ({ids, setArmed}), [ids, setArmed]);
  return (
    <SourceContext.Provider value={source}>
      <ArmedRepeatContext.Provider value={armedRepeat}>
        {children}
      </ArmedRepeatContext.Provider>
    </SourceContext.Provider>
  );
  // @ai-end
}

export function useAdhkarSessionSource(): SessionSource | null {
  return useContext(SourceContext);
}

// @ai-start
/**
 * Whether Repeat is armed for this dhikr (switched on before it plays), and
 * a setter. Each dhikr keeps its own: swiping to another page neither moves
 * nor clears it.
 */
export function useArmedRepeat(
  dhikrId: string,
): [boolean, (armed: boolean) => void] {
  const armedRepeat = useContext(ArmedRepeatContext);
  const setArmed = armedRepeat?.setArmed;
  const set = useCallback(
    (armed: boolean) => setArmed?.(dhikrId, armed),
    [setArmed, dhikrId],
  );
  return [armedRepeat?.ids.has(dhikrId) ?? false, set];
}
// @ai-end
