// @ai-generated
import i18n from '@/i18n';
import {currentLanguage} from '@/i18n/language';
import {SOURCE_LANGUAGE} from '@/i18n/languages';
import {localizeDigits} from '@/i18n/format';

const KNOWN_STYLES = ['murattal', 'mojawwad', 'molim'] as const;
type KnownStyle = (typeof KNOWN_STYLES)[number];

function isKnownStyle(value: string): value is KnownStyle {
  return (KNOWN_STYLES as readonly string[]).includes(value);
}

/**
 * Localized label for a rewayat recitation style ('murattal', 'mojawwad2', …).
 * English keeps the raw value so existing casing/textTransform styles apply.
 */
export function getRecitationStyleLabel(style: string): string {
  if (currentLanguage === SOURCE_LANGUAGE) {
    return style;
  }
  const match = /^([a-z]+)\s*(\d*)$/i.exec(style.trim());
  const base = match?.[1].toLowerCase() ?? '';
  if (!match || !isKnownStyle(base)) {
    return style;
  }
  const label = i18n.t(`common:styles.${base}`);
  return match[2] ? `${label} ${localizeDigits(match[2])}` : label;
}

// @ai-start
/**
 * The style label as a title ("Murattal"), for places that show it without
 * a textTransform, matching the reciter profile's rewayah tabs.
 */
export function getRecitationStyleTitle(style: string): string {
  const label = getRecitationStyleLabel(style);
  return currentLanguage === SOURCE_LANGUAGE
    ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
    : label;
}
// @ai-end
