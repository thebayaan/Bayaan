export type TranslationFitResult =
  | {status: 'fit'; fontSize: number; text: string; truncated: false}
  | {status: 'truncated'; fontSize: number; text: string; truncated: true}
  | {status: 'reject'};

export interface TranslationFitInput {
  text: string;
  fontSizes: number[]; // descending order, e.g. [22,20,18,16,14]
  maxHeight: number;
  measure: (text: string, fontSize: number) => number;
}

export function chooseTranslationFit(
  input: TranslationFitInput,
): TranslationFitResult {
  const {text, fontSizes, maxHeight, measure} = input;

  // 1. Try each size in descending order without truncation.
  for (const size of fontSizes) {
    if (measure(text, size) <= maxHeight) {
      return {status: 'fit', fontSize: size, text, truncated: false};
    }
  }

  // 2. At the floor size, truncate at word boundary until it fits.
  const floor = fontSizes[fontSizes.length - 1];
  if (measure('…', floor) > maxHeight) {
    return {status: 'reject'};
  }

  const words = text.split(/\s+/);
  let lo = 0;
  let hi = words.length;
  let best: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = words.slice(0, mid).join(' ').replace(/\s+$/, '') + '…';
    if (measure(candidate, floor) <= maxHeight) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best === null) {
    return {status: 'reject'};
  }

  return {status: 'truncated', fontSize: floor, text: best, truncated: true};
}
