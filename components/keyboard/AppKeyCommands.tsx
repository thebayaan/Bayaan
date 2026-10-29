// @ai-generated
import {useMemo} from 'react';
import {router, useSegments} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useKeyCommands} from '@/hooks/useKeyCommands';
import type {KeyBinding} from '@/services/keyboard/keyCommands';
import {
  closeFullPlayer,
  closeTopSheet,
  skipTrack,
  togglePlayback,
} from '@/services/keyboard/keyActions';

/**
 * The app-wide keyboard shortcuts on iPad (ipad-standards §7.3): Space plays
 * or pauses, ⌘← / ⌘→ change track, Esc closes the sheet, player or dialog on
 * top. The full player, the sidebar and the reader add their own on top.
 */
export function AppKeyCommands(): null {
  const {t} = useTranslation('common');
  const hasTrack = usePlayerStore(
    s => s.queue.tracks[s.queue.currentIndex] != null,
  );
  const isLastTrack = usePlayerStore(
    s => s.queue.currentIndex >= s.queue.tracks.length - 1,
  );
  const segments = useSegments();
  const onDialogRoute = segments[0] === 'translations';

  const bindings = useMemo<KeyBinding[]>(
    () => [
      {
        key: 'space',
        title: t('keyboard.playPause'),
        menu: 'playback',
        enabled: hasTrack,
        run: togglePlayback,
      },
      {
        key: 'cmd-left',
        title: t('keyboard.previousTrack'),
        menu: 'playback',
        enabled: hasTrack,
        run: () => skipTrack(-1),
      },
      {
        key: 'cmd-right',
        title: t('keyboard.nextTrack'),
        menu: 'playback',
        enabled: hasTrack && !isLastTrack,
        run: () => skipTrack(1),
      },
      {
        key: 'escape',
        title: t('keyboard.close'),
        menu: 'go',
        run: () => {
          if (closeTopSheet() || closeFullPlayer()) return;
          // The translations picker is a dialog over the reader on iPad.
          if (onDialogRoute && router.canGoBack()) router.back();
        },
      },
    ],
    [t, hasTrack, isLastTrack, onDialogRoute],
  );

  useKeyCommands(bindings, true, {base: true});
  return null;
}
