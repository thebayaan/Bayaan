import {useCallback, useMemo} from 'react';
import {useTVEventHandler} from 'react-native';
import type {HWEvent} from 'react-native';
import {
  createMediaKeyFilter,
  createRemoteKeyFilter,
  mediaKeyCommand,
  screenOwnsPlayPause,
} from '../services/remoteKeys';
import {useNavStore} from '../store/navStore';
import {useTVPlayerStore} from '../store/tvPlayerStore';

/**
 * The remote's Play/Pause works on every screen: it toggles the recitation
 * wherever focus is, except on the screens that handle the key themselves
 * (see screenOwnsPlayPause), so one press never toggles twice. Discrete
 * media keys (Play, Pause, Next, Previous on CEC and Android TV remotes)
 * are handled here on every screen (see mediaKeyCommand). Mounted once, by
 * the Router.
 */
export function useGlobalRemoteKeys(): void {
  const remoteFilter = useMemo(createRemoteKeyFilter, []);
  const mediaFilter = useMemo(createMediaKeyFilter, []);
  const handleTVEvent = useCallback(
    (event: HWEvent): void => {
      const player = useTVPlayerStore.getState();
      const {stack} = useNavStore.getState();
      const top = stack[stack.length - 1];

      const media = mediaFilter(event);
      if (media) {
        if (player.queue.length === 0) return;
        const command = mediaKeyCommand(media, top, player.status);
        if (command === 'toggle') player.toggle();
        else if (command === 'next') void player.next();
        else if (command === 'previous') void player.prev();
        return;
      }

      if (remoteFilter(event) !== 'playPause') return;
      if (screenOwnsPlayPause(top)) return;
      if (player.queue.length === 0) return;
      player.toggle();
    },
    [remoteFilter, mediaFilter],
  );
  useTVEventHandler(handleTVEvent);
}
