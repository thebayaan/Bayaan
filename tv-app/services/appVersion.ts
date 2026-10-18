import appConfig from '../app.json';

/**
 * The version Settings shows under the preview. On Apple TV and Android TV
 * it is the native build's version, set from app.json.
 */
export const APP_VERSION: string | null = appConfig.expo.version;
