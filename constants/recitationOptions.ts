// Rewayah and style options for recitations (used in uploads organize sheet and elsewhere)

export {DEFAULT_REWAYAH} from '@/data/rewayat';
import {getRewayahNames} from '@/data/rewayat';

export const DEFAULT_STYLE = 'murattal';

export const REWAYAH_OPTIONS = getRewayahNames();

export const STYLE_OPTIONS = [
  {id: 'murattal', label: 'Murattal'},
  {id: 'mojawwad', label: 'Mojawwad'},
  {id: 'molim', label: 'Molim'},
  {id: 'hadr', label: 'Hadr'},
] as const;

export const RECORDING_TYPE_OPTIONS = [
  {id: 'studio', label: 'Studio', icon: 'mic' as const},
  {id: 'salah', label: 'Salah', icon: 'moon' as const},
] as const;
