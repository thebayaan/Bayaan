import {Alert} from 'react-native';
// @ai-start
import i18n from '@/i18n';
// @ai-end

// @ai-start
export const handleError = (error: Error, customMessage?: string) => {
  console.error(error);
  Alert.alert(
    i18n.t('content:errors.title'),
    customMessage || i18n.t('content:errors.unexpected'),
    [{text: i18n.t('common:actions.ok')}],
  );
};
// @ai-end
