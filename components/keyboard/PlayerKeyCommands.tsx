// @ai-generated
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useKeyCommands} from '@/hooks/useKeyCommands';
import {localizeDigits} from '@/i18n/format';
import type {KeyBinding} from '@/services/keyboard/keyCommands';
import {KEY_SEEK_SECONDS, seekBy} from '@/services/keyboard/keyActions';

/**
 * Keyboard shortcuts while the full player is open (ipad-standards §7.3):
 * ← / → seek like the skip buttons, ⌘L toggles follow along. Space, ⌘← / ⌘→
 * and Esc come from the app-wide table. A component of its own, so the
 * player doesn't re-render when it opens.
 */
export function PlayerKeyCommands({
  onFollowAlongPress,
}: {
  onFollowAlongPress: () => void;
}): null {
  const {t} = useTranslation('common');
  const isOpen = usePlayerStore(s => s.sheetMode === 'full');
  const hasTrack = usePlayerStore(
    s => s.queue.tracks[s.queue.currentIndex] != null,
  );

  const bindings = useMemo<KeyBinding[]>(() => {
    const seconds = localizeDigits(KEY_SEEK_SECONDS);
    return [
      {
        key: 'left',
        title: t('keyboard.skipBack', {seconds}),
        menu: 'playback',
        enabled: hasTrack,
        repeatable: true,
        run: () => seekBy(-KEY_SEEK_SECONDS),
      },
      {
        key: 'right',
        title: t('keyboard.skipForward', {seconds}),
        menu: 'playback',
        enabled: hasTrack,
        repeatable: true,
        run: () => seekBy(KEY_SEEK_SECONDS),
      },
      {
        key: 'cmd-l',
        title: t('keyboard.followAlong'),
        menu: 'playback',
        enabled: hasTrack,
        run: onFollowAlongPress,
      },
    ];
  }, [t, hasTrack, onFollowAlongPress]);

  useKeyCommands(bindings, isOpen);
  return null;
}
