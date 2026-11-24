// @ai-generated
// The pictures behind Bayaan Now: one scene for each time of day, day of
// the week and special date. The images ship with the app
// (components/home/sceneImages); the backend can name a scene or send an
// image of its own.

export const SCENE_IDS = [
  'tahajjud',
  'fajr',
  'duha',
  'afternoon',
  'maghrib',
  'bedtime',
  'kahf',
  'lasthour',
  'fasting',
  'whitedays',
  'ramadan',
  'qadr',
  'eidfitr',
  'dhulhijjah',
  'arafah',
  'eidadha',
  'hijri',
  'ashura',
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export function isScene(value: unknown): value is SceneId {
  return (SCENE_IDS as readonly string[]).includes(value as string);
}

/** The scene for the hour when nothing more particular is going on. */
export function sceneForHour(now: Date): SceneId {
  const hour = now.getHours();
  if (hour >= 2 && hour < 4) return 'tahajjud';
  if (hour >= 4 && hour < 7) return 'fajr';
  if (hour >= 7 && hour < 12) return 'duha';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'maghrib';
  return 'bedtime';
}
