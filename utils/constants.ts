import {Dimensions, Platform} from 'react-native';
import {moderateScale} from 'react-native-size-matters';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

export const MAX_PLAYER_CONTENT_HEIGHT = SCREEN_HEIGHT * 0.45;
export const FLOATING_PLAYER_HEIGHT = moderateScale(58);
export const TAB_BAR_HEIGHT =
  Platform.OS === 'android' ? moderateScale(55, 0.5) : moderateScale(50, 0.5);
export const FLOATING_PLAYER_BOTTOM_MARGIN = moderateScale(14, 0.1);
export const FLOATING_UI_HORIZONTAL_MARGIN = moderateScale(16);
export const FLOATING_TAB_BAR_BOTTOM_MARGIN = moderateScale(12);

export const getFloatingPlayerBottomPosition = (bottomInset = 0): number => {
  return (
    TAB_BAR_HEIGHT +
    bottomInset +
    FLOATING_PLAYER_BOTTOM_MARGIN +
    FLOATING_TAB_BAR_BOTTOM_MARGIN
  );
};
