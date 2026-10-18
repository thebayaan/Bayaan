// app/player.tsx
import {expandPlayerSheet} from '@/services/player/sheetRef';
import {useLeaveLinkRoute} from '@/hooks/useLeaveLinkRoute';

// Expanding while the navigation transition runs gets cancelled by the
// sheet's onChange, so open it once navigation has settled.
const EXPAND_DELAY_MS = 400;

function expandSoon(): void {
  setTimeout(expandPlayerSheet, EXPAND_DELAY_MS);
}

// bayaan://player (widgets): the full player over the screen underneath.
export default function PlayerDeepLink(): null {
  useLeaveLinkRoute(expandSoon);
  return null;
}
