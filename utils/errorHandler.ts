import {Alert} from 'react-native';

export const handleError = (error: Error, customMessage?: string) => {
  console.error(error);
  Alert.alert(
    'Error',
    customMessage || 'An unexpected error occurred. Please try again.',
    [{text: 'OK'}],
  );
};
