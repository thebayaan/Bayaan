// bayaan://adhkar-playing (lock screen, Live Activity): the playing dhikr's
// reader, or the Adhkar screen when nothing is playing or saved. A cold launch
// mounts this before the saved session is restored, so it waits for the
// restore first (at most RESTORE_WAIT_MS).
import {useEffect} from 'react';
import {useNavigation, useNavigationContainerRef} from 'expo-router';
import {
  ADHKAR_SCREEN,
  adhkarStackAction,
  openPlayingDhikr,
} from '@/services/adhkar/playback/openPlayingDhikr';
import {waitForSessionRestore} from '@/services/adhkar/playback/sessionPersistence';

const RESTORE_WAIT_MS = 3000;

export default function AdhkarPlayingRoute(): null {
  // The route's own navigation sees the root stack as soon as this renders;
  // the container's state can still be filling in on a cold launch.
  const navigation = useNavigation();
  const container = useNavigationContainerRef();
  useEffect(() => {
    let cancelled = false;
    // The extra frame lets a cold launch apply the link's initial state
    // first; a back dispatched before that is dropped.
    const restored = waitForSessionRestore(RESTORE_WAIT_MS).then(
      () =>
        new Promise<void>(resolve => requestAnimationFrame(() => resolve())),
    );
    restored.then(() => {
      if (cancelled) return;
      // Leave this route first, so the navigation below runs against the
      // tabs. Replacing it with a tab route instead would stack a second copy
      // of the tabs with nothing to go back to.
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.dispatch({type: 'REPLACE', payload: {name: '(tabs)'}});
      if (!openPlayingDhikr(container, null)) {
        container.dispatch(adhkarStackAction([ADHKAR_SCREEN]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigation, container]);
  return null;
}
