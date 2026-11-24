// @ai-generated
// How a Bayaan Now moment looks and reads: a scene the app ships with or an
// image of its own, and words that can stand in for the ones the rules
// write. The backend sets these for a key date; otherwise the moment picks
// its scene. Every surface (Home, the widget, CarPlay, TV) can read the
// same look.
import {isScene, type SceneId} from './scenes';

/** The skies earlier builds of the backend name, and the scene each became. */
const LEGACY_SKIES: Record<string, SceneId> = {
  fajr: 'fajr',
  morning: 'duha',
  jumuah: 'kahf',
  midday: 'afternoon',
  sunset: 'maghrib',
  night: 'bedtime',
  ramadan: 'ramadan',
  eid: 'eidfitr',
  arafah: 'arafah',
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
  | {kind: 'scene'; scene: SceneId}
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

function isText(value: unknown): value is LocalizedText {
  if (typeof value === 'string') return value.trim().length > 0;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every(v => typeof v === 'string');
}

/** A look from the backend, or undefined when it can't be used. */
export function parseLook(value: unknown): NowLook | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (v.kind === 'scene' && isScene(v.scene)) {
    return {kind: 'scene', scene: v.scene};
  }
  if (v.kind === 'sky' && typeof v.preset === 'string') {
    const scene = LEGACY_SKIES[v.preset];
    return scene ? {kind: 'scene', scene} : undefined;
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
