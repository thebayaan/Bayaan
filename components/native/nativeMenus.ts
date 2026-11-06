// @ai-generated
import {Platform} from 'react-native';

/** Native menus exist on iOS and Android; web keeps its sheets. */
export const nativeMenusAvailable =
  Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Long-press and secondary-click menus on list rows and cards (iPad). One
 * switch to turn them off if hosting every visible row costs too much
 * scroll performance on a device.
 */
export const rowContextMenusEnabled = true;
