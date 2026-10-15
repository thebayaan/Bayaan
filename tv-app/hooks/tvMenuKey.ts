import {Platform, TVEventControl} from 'react-native';

/**
 * On tvOS the Menu button only reaches JS (as a back press) while the menu
 * key is enabled, and while it is enabled Menu cannot exit the app.
 */
export function setTVMenuKeyEnabled(enabled: boolean): void {
  if (Platform.OS !== 'ios') return;
  if (enabled) {
    TVEventControl.enableTVMenuKey();
    return;
  }
  TVEventControl.disableTVMenuKey();
}
