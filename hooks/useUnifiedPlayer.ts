/**
 * @deprecated Use `usePlayerActions()` for actions and `usePlayerStore(selector)` for state.
 *
 * This hook subscribes to the ENTIRE playerStore, causing re-renders on every
 * state change (including position updates every second). This kills Android performance.
 *
 * Migration guide:
 * - Actions only: `const { play, pause, updateQueue } = usePlayerActions();`
 * - State + actions: `const queue = usePlayerStore(s => s.queue); const { play } = usePlayerActions();`
 */
import {usePlayerStore} from '@/services/player/store/playerStore';
import {usePlayerActions} from '@/hooks/usePlayerActions';

export function useUnifiedPlayer() {
  const store = usePlayerStore();
  const actions = usePlayerActions();

  return {
    // State (reactive - causes re-renders)
    playback: store.playback,
    queue: store.queue,
    loading: store.loading,
    error: store.error,
    settings: store.settings,
    sheetMode: store.sheetMode,

    // Actions (stable references - no re-renders)
    ...actions,
  };
}
