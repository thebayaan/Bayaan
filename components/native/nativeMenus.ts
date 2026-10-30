// @ai-generated
import {Platform} from 'react-native';

/** Native menus exist on iOS and Android; web keeps its sheets. */
export const nativeMenusAvailable =
  Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Native ••• and context menus on phones. Off, phones go back to their
 * bottom sheets and only tablets get native menus.
 */
export const phoneMenusEnabled = true;

/**
 * Long-press and secondary-click menus on list rows and cards (iPad). One
 * switch to turn them off if hosting every visible row costs too much
 * scroll performance on a device.
 */
export const rowContextMenusEnabled = true;

/**
 * The same menus on surah and track list rows (iPad). Off: each row's
 * context menu wraps it in a host that sizes it, and the reciter page lays
 * out all 114 rows at once, so it took long to settle after a tab switch.
 * Cards keep theirs. The rows' ••• still opens a native menu.
 */
export const listRowContextMenusEnabled = false;
