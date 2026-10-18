import {useEffect} from 'react';
import {activateKeepAwakeAsync, deactivateKeepAwake} from 'expo-keep-awake';

/**
 * Keeps the TV from dimming or starting its screensaver while `active`, e.g.
 * while a recitation plays in the listening room. Released as soon as it
 * turns false (paused) or the screen unmounts, so a paused TV still sleeps.
 */
export function useKeepAwakeWhile(active: boolean, tag: string): void {
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [active, tag]);
}
