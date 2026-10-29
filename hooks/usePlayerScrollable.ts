// @ai-generated
import {usePlayerDismissApi} from '@/components/player/v2/PlayerDismissContext';

/**
 * Scroll component for the player's Mushaf and queue lists, supplied by the
 * player container (the morphing PlayerSurface) so a
 * downward drag at the top of the list dismisses the player. Undefined when
 * rendered outside a player container.
 */
export function usePlayerScrollable() {
  return usePlayerDismissApi().renderScrollComponent;
}
