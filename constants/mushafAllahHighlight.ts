// @ai-start
import i18n from '@/i18n';
// @ai-end
import type {MushafAllahNameHighlightColor} from '@/store/mushafSettingsStore';

export interface AllahNameHighlightOption {
  id: MushafAllahNameHighlightColor;
  label: string;
  light: string;
  dark: string;
}

// @ai-start
export const ALLAH_NAME_HIGHLIGHT_OPTIONS: AllahNameHighlightOption[] = [
  {
    id: 'gold',
    get label() {
      return i18n.t('content:allahHighlight.gold');
    },
    light: '#A86A00',
    dark: '#F6C453',
  },
  {
    id: 'emerald',
    get label() {
      return i18n.t('content:allahHighlight.emerald');
    },
    light: '#1F7A52',
    dark: '#68D391',
  },
  {
    id: 'blue',
    get label() {
      return i18n.t('content:allahHighlight.blue');
    },
    light: '#2B6CB0',
    dark: '#63B3ED',
  },
  {
    id: 'rose',
    get label() {
      return i18n.t('content:allahHighlight.rose');
    },
    light: '#C05669',
    dark: '#FC8181',
  },
];
// @ai-end

export function getAllahNameHighlightColorHex(
  color: MushafAllahNameHighlightColor,
  isDarkMode: boolean,
): string {
  const option =
    ALLAH_NAME_HIGHLIGHT_OPTIONS.find(entry => entry.id === color) ??
    ALLAH_NAME_HIGHLIGHT_OPTIONS[0];
  return isDarkMode ? option.dark : option.light;
}
