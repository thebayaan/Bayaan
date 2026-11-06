import {Platform} from 'react-native';

/**
 * Listening to recitation is iOS only for now: it has not had a device pass on
 * Android, where RECORD_AUDIO is also left out until then (app.config.js).
 * Everything that needs the mic hides behind this.
 */
export const RECITATION_AVAILABLE = Platform.OS === 'ios';
