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
