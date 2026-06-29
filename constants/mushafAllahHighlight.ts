import type {MushafAllahNameHighlightColor} from '@/store/mushafSettingsStore';

export interface AllahNameHighlightOption {
  id: MushafAllahNameHighlightColor;
  label: string;
  light: string;
  dark: string;
}

export const ALLAH_NAME_HIGHLIGHT_OPTIONS: AllahNameHighlightOption[] = [
  {
    id: 'gold',
    label: 'Gold',
    light: '#A86A00',
    dark: '#F6C453',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    light: '#1F7A52',
    dark: '#68D391',
  },
  {
    id: 'blue',
    label: 'Blue',
    light: '#2B6CB0',
    dark: '#63B3ED',
  },
  {
    id: 'rose',
    label: 'Rose',
    light: '#C05669',
    dark: '#FC8181',
  },
];

export function getAllahNameHighlightColorHex(
  color: MushafAllahNameHighlightColor,
  isDarkMode: boolean,
): string {
  const option =
    ALLAH_NAME_HIGHLIGHT_OPTIONS.find(entry => entry.id === color) ??
    ALLAH_NAME_HIGHLIGHT_OPTIONS[0];
  return isDarkMode ? option.dark : option.light;
}
