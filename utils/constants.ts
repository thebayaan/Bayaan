import {Dimensions, Platform} from 'react-native';
import {moderateScale} from 'react-native-size-matters';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

export const MAX_PLAYER_CONTENT_HEIGHT = SCREEN_HEIGHT * 0.45;
export const FLOATING_PLAYER_HEIGHT = moderateScale(65);
export const TAB_BAR_HEIGHT =
  Platform.OS === 'android' ? moderateScale(55, 0.5) : moderateScale(50, 0.5); // Base tab bar height excluding insets
export const FLOATING_PLAYER_BOTTOM_MARGIN = moderateScale(10, 0.1); // Margin between floating player and tab bar

// This will be used as the total bottom padding in scrollable content
export const TOTAL_BOTTOM_PADDING = FLOATING_PLAYER_HEIGHT;

// Calculate the position from the bottom for the floating player based on tab bar height and insets
export const getFloatingPlayerBottomPosition = (bottomInset = 0): number => {
  return TAB_BAR_HEIGHT + bottomInset + FLOATING_PLAYER_BOTTOM_MARGIN;
};
