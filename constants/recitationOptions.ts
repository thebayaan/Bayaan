// Rewayah and style options for recitations (used in uploads organize sheet and elsewhere)

export {DEFAULT_REWAYAH} from '@/data/rewayat';
// @ai-start
import i18n from '@/i18n';
// @ai-end
import {getRewayahNames} from '@/data/rewayat';

export const DEFAULT_STYLE = 'murattal';

export const REWAYAH_OPTIONS = getRewayahNames();

// @ai-start
export const STYLE_OPTIONS = [
  {
    id: 'murattal',
    get label() {
      return i18n.t('content:recitation.styles.murattal');
    },
  },
  {
    id: 'mojawwad',
    get label() {
      return i18n.t('content:recitation.styles.mojawwad');
    },
  },
  {
    id: 'molim',
    get label() {
      return i18n.t('content:recitation.styles.molim');
    },
  },
  {
    id: 'hadr',
    get label() {
      return i18n.t('content:recitation.styles.hadr');
    },
  },
] as const;
// @ai-end

// @ai-start
export const RECORDING_TYPE_OPTIONS = [
  {
    id: 'studio',
    get label() {
      return i18n.t('content:recitation.recordingTypes.studio');
    },
    icon: 'mic' as const,
  },
  {
    id: 'salah',
    get label() {
      return i18n.t('content:recitation.recordingTypes.salah');
    },
    icon: 'moon' as const,
  },
] as const;
// @ai-end
