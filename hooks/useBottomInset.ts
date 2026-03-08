import {Platform} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  FLOATING_PLAYER_HEIGHT,
  TAB_BAR_HEIGHT,
  FLOATING_PLAYER_BOTTOM_MARGIN,
  FLOATING_TAB_BAR_BOTTOM_MARGIN,
} from '@/utils/constants';

// iOS NativeTabs: standard UITabBar content height (excludes safe area)
const IOS_TAB_BAR_HEIGHT = 49;
// iOS BottomAccessory (MiniPlayer): paddingTop(8) + artwork(36) + paddingBottom(20)
const IOS_MINI_PLAYER_HEIGHT = 64;

/**
 * Returns the total bottom padding needed for tab screen content
 * to clear the tab bar and mini player.
 *
 * - iOS: Accounts for NativeTabs tab bar + BottomAccessory (MiniPlayer) + safe area.
 * - Android: Accounts for floating tab bar + floating player + margins + safe area.
 */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  const hasTrack = usePlayerStore(state => {
    const tracks = state.queue.tracks;
    const index = state.queue.currentIndex;
    return tracks.length > 0 && tracks[index] != null;
  });

  if (Platform.OS === 'ios') {
    let bottom = IOS_TAB_BAR_HEIGHT + insets.bottom;
    if (hasTrack) {
      bottom += IOS_MINI_PLAYER_HEIGHT;
    }
    return bottom;
  }

  let bottom = TAB_BAR_HEIGHT + FLOATING_TAB_BAR_BOTTOM_MARGIN + insets.bottom;

  if (hasTrack) {
    bottom += FLOATING_PLAYER_HEIGHT + FLOATING_PLAYER_BOTTOM_MARGIN;
  }

  return bottom;
}
