// @ai-generated
// How a Bayaan Now moment looks and reads: a preset sky or an image of its
// own, and words that can stand in for the ones the rules write. The
// backend sets these for a key date; otherwise the time of day picks the
// sky. Every surface (Home, the widget, CarPlay, TV) can read the same look.
import type {NowReason} from './moments';

/** The skies Bayaan Now ships with. */
export const SKY_PRESET_IDS = [
  'fajr',
  'morning',
  'jumuah',
  'midday',
  'sunset',
  'night',
  'ramadan',
  'eid',
  'arafah',
] as const;

export type SkyPresetId = (typeof SKY_PRESET_IDS)[number];

/** What crosses the sky: the sun by day, the moon by night, or nothing. */
export type SkyBody = 'sun' | 'moon' | 'none';

export interface SkyPreset {
  /** Top to bottom. */
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
  stars: number;
  body: SkyBody;
  /** The glow around the sun, or the moon's light. */
  glow: string;
}

export const SKY_PRESETS: Record<SkyPresetId, SkyPreset> = {
  fajr: {
    colors: ['#1e1b4b', '#6d28d9', '#f472b6', '#fdba74'],
    locations: [0, 0.4, 0.72, 1],
    stars: 8,
    body: 'sun',
    glow: '#fde68a',
  },
  morning: {
    colors: ['#1e3a8a', '#3b82f6', '#fb923c', '#fcd34d'],
    locations: [0, 0.36, 0.8, 1],
    stars: 0,
    body: 'sun',
    glow: '#fde68a',
  },
  jumuah: {
    colors: ['#052e2b', '#0f766e', '#34d399', '#fde68a'],
    locations: [0, 0.4, 0.82, 1],
    stars: 0,
    body: 'sun',
    glow: '#fef3c7',
  },
  midday: {
    colors: ['#0c4a6e', '#0284c7', '#7dd3fc'],
    locations: [0, 0.48, 1],
    stars: 0,
    body: 'sun',
    glow: '#fffbeb',
  },
  sunset: {
    colors: ['#1e1b4b', '#6d28d9', '#db2777', '#fb923c'],
    locations: [0, 0.45, 0.82, 1],
    stars: 7,
    body: 'sun',
    glow: '#fed7aa',
  },
  night: {
    colors: ['#020617', '#0b1d4d', '#1e3a8a'],
    locations: [0, 0.65, 1],
    stars: 18,
    body: 'moon',
    glow: '#e2e8f0',
  },
  ramadan: {
    colors: ['#14041f', '#3b0a45', '#9d174d'],
    locations: [0, 0.55, 1],
    stars: 20,
    body: 'moon',
    glow: '#fce7f3',
  },
  eid: {
    colors: ['#0f172a', '#155e75', '#14b8a6', '#fcd34d'],
    locations: [0, 0.42, 0.78, 1],
    stars: 10,
    body: 'moon',
    glow: '#fef9c3',
  },
  arafah: {
    colors: ['#431407', '#c2410c', '#f59e0b', '#fde68a'],
    locations: [0, 0.4, 0.78, 1],
    stars: 0,
    body: 'sun',
    glow: '#fffbeb',
  },
};

/** Words the backend can send in one language or several. */
export type LocalizedText = string | Readonly<Record<string, string>>;

/** Words that stand in for the ones the rules write. */
export interface NowContent {
  /** The small label above the title, such as "Friday" or "Tonight". */
  label?: LocalizedText;
  title?: LocalizedText;
  subtitle?: LocalizedText;
}

export type NowLook =
  | {kind: 'sky'; preset: SkyPresetId}
  | {
      kind: 'image';
      uri: string;
      /** The colour behind the image while it loads, and under the words. */
      tint?: string;
      /** How dark the wash under the words is, from 0 to 1. */
      scrim?: number;
    };

/** The text in this language, else English, else any. */
export function localize(
  text: LocalizedText | undefined,
  language: string,
): string | undefined {
  if (text === undefined) return undefined;
  if (typeof text === 'string') return text;
  const base = language.split('-')[0];
  return text[language] ?? text[base] ?? text.en ?? Object.values(text)[0];
}

/** The sky for a moment when nothing else sets one. */
export function defaultSky(reason: NowReason, now: Date): SkyPresetId {
  if (reason === 'friday') return 'jumuah';
  const hour = now.getHours();
  if (hour >= 21 || hour < 4) return 'night';
  if (hour < 6) return 'fajr';
  if (hour < 11) return 'morning';
  if (hour < 16) return 'midday';
  if (hour < 19) return 'sunset';
  return 'night';
}

const DAY_START = 5;
const DAY_END = 19;

/**
 * Where the sun or moon sits on the arc, as shares of the sky: x from the
 * start of the day (or night) to its end, y from the top. The sun crosses
 * from 5 AM to 7 PM and the moon from 7 PM to 5 AM.
 */
export function bodyPosition(body: SkyBody, now: Date): {x: number; y: number} {
  const hours = now.getHours() + now.getMinutes() / 60;
  let progress: number;
  if (body === 'moon') {
    const sinceDusk = (hours - DAY_END + 24) % 24;
    progress = sinceDusk / (24 - DAY_END + DAY_START);
  } else {
    progress = (hours - DAY_START) / (DAY_END - DAY_START);
  }
  // Keep it clear of the edges, where it would be cut off.
  const x = 0.1 + 0.8 * Math.min(1, Math.max(0, progress));
  // The arc: low at both ends, highest in the middle.
  const lift = 4 * x * (1 - x);
  const y = 0.62 - 0.4 * lift;
  return {x, y};
}

function isPreset(value: unknown): value is SkyPresetId {
  return (SKY_PRESET_IDS as readonly string[]).includes(value as string);
}

function isText(value: unknown): value is LocalizedText {
  if (typeof value === 'string') return value.trim().length > 0;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every(v => typeof v === 'string');
}

/** A look from the backend, or undefined when it can't be used. */
export function parseLook(value: unknown): NowLook | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (v.kind === 'sky' && isPreset(v.preset)) {
    return {kind: 'sky', preset: v.preset};
  }
  if (
    v.kind === 'image' &&
    typeof v.uri === 'string' &&
    /^https:\/\//.test(v.uri)
  ) {
    return {
      kind: 'image',
      uri: v.uri,
      tint: typeof v.tint === 'string' ? v.tint : undefined,
      scrim:
        typeof v.scrim === 'number'
          ? Math.min(1, Math.max(0, v.scrim))
          : undefined,
    };
  }
  return undefined;
}

/** Content from the backend, keeping only the fields that can be used. */
export function parseContent(value: unknown): NowContent | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const content: NowContent = {};
  if (isText(v.label)) content.label = v.label;
  if (isText(v.title)) content.title = v.title;
  if (isText(v.subtitle)) content.subtitle = v.subtitle;
  return Object.keys(content).length > 0 ? content : undefined;
}
