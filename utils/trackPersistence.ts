import AsyncStorage from '@react-native-async-storage/async-storage';
import {Track} from '@/types/audio';

const LAST_TRACK_KEY = '@bayaan/last_track';
const LAST_POSITION_KEY = '@bayaan/last_position';

export const saveLastTrack = async (track: Track) => {
  try {
    await AsyncStorage.setItem(LAST_TRACK_KEY, JSON.stringify(track));
  } catch (error) {
    console.error('Error saving last track:', error);
  }
};

export const saveLastPosition = async (position: number) => {
  try {
    await AsyncStorage.setItem(LAST_POSITION_KEY, position.toString());
  } catch (error) {
    console.error('Error saving last position:', error);
  }
};

export const getLastTrack = async (): Promise<Track | null> => {
  try {
    const trackJson = await AsyncStorage.getItem(LAST_TRACK_KEY);
    return trackJson ? JSON.parse(trackJson) : null;
  } catch (error) {
    console.error('Error getting last track:', error);
    return null;
  }
};

export const getLastPosition = async (): Promise<number> => {
  try {
    const position = await AsyncStorage.getItem(LAST_POSITION_KEY);
    return position ? parseFloat(position) : 0;
  } catch (error) {
    console.error('Error getting last position:', error);
    return 0;
  }
};
