// @ai-generated
import 'intl-pluralrules';
import i18n, {type PostProcessorModule} from 'i18next';
import {initReactI18next} from 'react-i18next';
import {currentLanguage} from './language';
import {localizeDigits} from './format';
import {resources, defaultNS, namespaces} from './resources';
import {SOURCE_LANGUAGE, getLanguageConfig} from './languages';

const localizedDigits: PostProcessorModule = {
  type: 'postProcessor',
  name: 'localizedDigits',
  process: (value: string) => localizeDigits(value),
};

i18n
  .use(initReactI18next)
  .use(localizedDigits)
  .init({
    resources,
    lng: currentLanguage,
    fallbackLng: SOURCE_LANGUAGE,
    ns: namespaces,
    defaultNS,
    initAsync: false,
    returnNull: false,
    // An empty value (a key not translated yet) falls back to English.
    returnEmptyString: false,
    interpolation: {escapeValue: false},
    postProcess:
      getLanguageConfig(currentLanguage).digits === 'latn'
        ? false
        : ['localizedDigits'],
    react: {useSuspense: false},
  });

export {currentLanguage};
export default i18n;
