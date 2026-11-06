// services/widgets/dhikrText.ts
// Dhikr text cleanup shared by the Tasbeeh catalog and the generated adhkar
// data. Imported by scripts/generate-widget-data.ts, so no '@/' imports here.
import {
  parseAdhkarArabic,
  segmentAdhkarTranslation,
} from '../../utils/adhkarText';

// Drops ( ) and [ ] groups, innermost first, so nested ones leave nothing.
function withoutParentheticals(text: string): string {
  let current = text;
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(/\([^()]*\)/g, ' ').replace(/\[[^[\]]*\]/g, ' ');
  }
  return current
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?،])/g, '$1')
    .trim();
}

// The dhikr itself: the (( )) segments of a row that opens with one, without
// narration, additions or counts like (ثلاثاً).
export function tasbeehDisplayText(arabic: string): string | null {
  const text = arabic.trim();
  if (!text.startsWith('((')) return null;
  const dhikr = parseAdhkarArabic(text)
    .filter(segment => segment.kind === 'dhikr')
    .map(segment => withoutParentheticals(segment.text))
    .filter(Boolean)
    .join(' ')
    .replace(/[\s.،,:]+$/, '');
  return dhikr || null;
}

export function tasbeehTranslation(translation: string | null): string | null {
  if (translation === null) return null;
  const dhikr = segmentAdhkarTranslation(translation)
    .filter(segment => segment.kind === 'dhikr')
    .map(segment => segment.text)
    .join(' ');
  const cleaned = withoutParentheticals(dhikr)
    .replace(/^[‘’'"]+|[‘’'"]+$/g, '')
    .trim();
  return cleaned || null;
}
