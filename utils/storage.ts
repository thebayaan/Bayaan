import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = AsyncStorage;

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
    console.log('Storage successfully cleared!');
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
};

export const clearRecentRecitersStorage = async () => {
  try {
    await AsyncStorage.removeItem('recent-reciters-storage');
    console.log('Recent reciters storage cleared!');
  } catch (error) {
    console.error('Error clearing recent reciters storage:', error);
  }
};
