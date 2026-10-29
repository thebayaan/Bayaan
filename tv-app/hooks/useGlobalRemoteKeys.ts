import {useCallback, useMemo} from 'react';
import {useTVEventHandler} from 'react-native';
import type {HWEvent} from 'react-native';
import {applyMediaKey} from '../services/mediaTransport';
import {createMediaKeyFilter, screenOwnsMediaKey} from '../services/remoteKeys';
import {useNavStore} from '../store/navStore';

/**
 * The remote's transport keys (Play/Pause, Next, Previous, Fast-forward,
 * Rewind) work on every screen: they drive the recitation wherever focus is,
 * except for the keys the screen on top handles itself (screenOwnsMediaKey),
 * so one press never acts twice. Mounted once, by the Router.
 */
export function useGlobalRemoteKeys(): void {
  const mediaFilter = useMemo(createMediaKeyFilter, []);
  const handleTVEvent = useCallback(
    (event: HWEvent): void => {
      const key = mediaFilter(event);
      if (!key) return;
      const {stack} = useNavStore.getState();
      if (screenOwnsMediaKey(stack[stack.length - 1], key)) return;
      applyMediaKey(key);
    },
    [mediaFilter],
  );
  useTVEventHandler(handleTVEvent);
}
