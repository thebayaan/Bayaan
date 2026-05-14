import type {Signal} from './types';

const MORNING_START = 5;
const MORNING_END = 12;
const EVENING_START = 18;
const EVENING_END = 21;

// Adhkar category "27" is the morning/evening adhkar category in data/adhkar.json.
// We boost it under either window since the data file uses one combined category for both.
const MORNING_ADHKAR_IDS = new Set(['27']);
const EVENING_ADHKAR_IDS = new Set(['27']);
const FRIDAY_SURAH_IDS = new Set([18]); // Al-Kahf

export interface ContextualOptions {
  now?: number;
}

export interface ContextualBoost {
  boost: number;
  signal: Signal | null;
}

export function computeContextualBoost(
  resultId: string,
  opts: ContextualOptions = {},
): ContextualBoost {
  const date = new Date(opts.now ?? Date.now());
  const hour = date.getHours();
  const isFriday = date.getDay() === 5;
  const isMorning = hour >= MORNING_START && hour < MORNING_END;
  const isEvening = hour >= EVENING_START && hour < EVENING_END;

  let boost = 0;
  let signal: Signal | null = null;

  if (resultId.startsWith('adhkar:')) {
    const id = resultId.slice('adhkar:'.length);
    if (isMorning && MORNING_ADHKAR_IDS.has(id)) {
      boost += 0.1;
      signal = 'morning';
    } else if (isEvening && EVENING_ADHKAR_IDS.has(id)) {
      boost += 0.1;
      signal = 'evening';
    }
  }

  if (resultId.startsWith('surah:')) {
    const id = Number(resultId.slice('surah:'.length));
    if (isFriday && FRIDAY_SURAH_IDS.has(id)) {
      boost += 0.12;
      if (!signal) signal = 'friday';
    }
  }

  return {boost: Math.min(0.15, boost), signal};
}
