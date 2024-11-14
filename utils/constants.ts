import {Dimensions} from 'react-native';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

export const MAX_PLAYER_CONTENT_HEIGHT = SCREEN_HEIGHT * 0.45;
export const FLOATING_PLAYER_HEIGHT = 65;
export const TOTAL_BOTTOM_PADDING = FLOATING_PLAYER_HEIGHT;
