// @ai-generated
import i18n from '@/i18n';
import {localizeDigits} from '@/i18n/format';

type StyleKey = 'murattal' | 'mojawwad' | 'molim';
const STYLE_KEYS: ReadonlySet<string> = new Set<StyleKey>([
  'murattal',
  'mojawwad',
  'molim',
]);

/**
 * Localized recitation style label. Data values may carry a duplicate suffix
 * (e.g. "murattal 2"), which is kept and digit-localized.
 */
export function getStyleLabel(style: string | null | undefined): string {
  if (!style) return '';
  const [base, ...rest] = style.trim().split(/\s+/);
  const normalized = base.toLowerCase();
  if (!STYLE_KEYS.has(normalized)) return style;
  const label = i18n.t(`common:styles.${normalized as StyleKey}`);
  return rest.length > 0 ? `${label} ${localizeDigits(rest.join(' '))}` : label;
}
