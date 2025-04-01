import {Dimensions, Platform} from 'react-native';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

export const MAX_PLAYER_CONTENT_HEIGHT = SCREEN_HEIGHT * 0.45;
export const FLOATING_PLAYER_HEIGHT = 65;
export const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 55 : 50; // Base tab bar height excluding insets
export const FLOATING_PLAYER_BOTTOM_MARGIN = 20; // Margin between floating player and tab bar

// This will be used as the total bottom padding in scrollable content
export const TOTAL_BOTTOM_PADDING = FLOATING_PLAYER_HEIGHT;

// Calculate the position from the bottom for the floating player based on tab bar height and insets
export const getFloatingPlayerBottomPosition = (bottomInset: number = 0): number => {
  // Only apply insets on iOS as Android handles this differently
  const insetToApply = Platform.OS === 'ios' ? bottomInset : 0;
  return TAB_BAR_HEIGHT + insetToApply + FLOATING_PLAYER_BOTTOM_MARGIN;
};
