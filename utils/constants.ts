import {Dimensions, Platform} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {getIsTablet} from '@/utils/responsive';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

// Cap the player sheet content height on tablets so it doesn't stretch edge to edge.
export const MAX_PLAYER_CONTENT_HEIGHT = getIsTablet()
  ? Math.min(SCREEN_HEIGHT * 0.45, 520)
  : SCREEN_HEIGHT * 0.45;
export const FLOATING_PLAYER_HEIGHT = moderateScale(50);
export const TAB_BAR_HEIGHT =
  Platform.OS === 'android' ? moderateScale(55, 0.5) : moderateScale(50, 0.5);
export const FLOATING_PLAYER_BOTTOM_MARGIN = moderateScale(8, 0.1);
export const FLOATING_UI_HORIZONTAL_MARGIN = moderateScale(10);
export const FLOATING_TAB_BAR_BOTTOM_MARGIN = 0;

export const getFloatingPlayerBottomPosition = (bottomInset = 0): number => {
  return (
    TAB_BAR_HEIGHT +
    bottomInset +
    FLOATING_PLAYER_BOTTOM_MARGIN +
    FLOATING_TAB_BAR_BOTTOM_MARGIN
  );
};
