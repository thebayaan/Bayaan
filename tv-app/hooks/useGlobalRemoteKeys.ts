import {useCallback, useMemo} from 'react';
import {useTVEventHandler} from 'react-native';
import type {HWEvent} from 'react-native';
import {
  createRemoteKeyFilter,
  screenOwnsPlayPause,
} from '../services/remoteKeys';
import {useNavStore} from '../store/navStore';
import {useTVPlayerStore} from '../store/tvPlayerStore';

/**
 * The remote's Play/Pause works on every screen: it toggles the recitation
 * wherever focus is, except on the screens that handle the key themselves
 * (see screenOwnsPlayPause), so one press never toggles twice. Mounted once,
 * by the Router.
 */
export function useGlobalRemoteKeys(): void {
  const remoteFilter = useMemo(createRemoteKeyFilter, []);
  const handleTVEvent = useCallback(
    (event: HWEvent): void => {
      if (remoteFilter(event) !== 'playPause') return;
      const {stack} = useNavStore.getState();
      if (screenOwnsPlayPause(stack[stack.length - 1])) return;
      const player = useTVPlayerStore.getState();
      if (player.queue.length === 0) return;
      player.toggle();
    },
    [remoteFilter],
  );
  useTVEventHandler(handleTVEvent);
}
