// components/adhkar/AdhkarSessionSourceContext.tsx
// The list a reader shows, as a SessionSource, so a card's play button can
// start or toggle the session without prop drilling through DhikrReader.
import React, {createContext, useContext} from 'react';
import type {SessionSource} from '@/services/adhkar/playback/types';

const SourceContext = createContext<SessionSource | null>(null);

export function AdhkarSessionSourceProvider({
  source,
  children,
}: {
  source: SessionSource | null;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SourceContext.Provider value={source}>{children}</SourceContext.Provider>
  );
}

export function useAdhkarSessionSource(): SessionSource | null {
  return useContext(SourceContext);
}
