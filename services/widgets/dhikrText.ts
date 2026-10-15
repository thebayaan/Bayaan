// services/widgets/dhikrText.ts
// Dhikr text cleanup shared by the Tasbeeh catalog and the generated adhkar
// data. Imported by scripts/generate-widget-data.ts, so no '@/' imports here.

function withoutParentheticals(text: string): string {
  return text
    .replace(/\([^()]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Content of the first balanced (...) group, or the text itself.
function firstGroup(text: string): string {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(1, i);
    }
  }
  return text;
}

// The dhikr itself: the text inside (( )) without counts like (ثلاثاً).
export function tasbeehDisplayText(arabic: string): string | null {
  const text = arabic.trim();
  const end = text.lastIndexOf('))');
  if (!text.startsWith('((') || end <= 2) return null;
  const inner = withoutParentheticals(text.slice(2, end)).replace(
    /[\s.،,:]+$/,
    '',
  );
  return inner || null;
}

export function tasbeehTranslation(translation: string | null): string | null {
  if (translation === null) return null;
  let text = translation.trim();
  if (text.startsWith('(')) text = firstGroup(text);
  const cleaned = withoutParentheticals(text)
    .replace(/^[‘’'"]+|[‘’'"]+$/g, '')
    .trim();
  return cleaned || null;
}
