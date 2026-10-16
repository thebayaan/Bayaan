import {isNullableString, isRecord} from './guards';

export const WIDGET_AMBIENT_SOUNDS = [
  'rain',
  'forest',
  'ocean',
  'stream',
  'thunder',
  'fireplace',
  'wind',
] as const;

export type WidgetAmbientSound = (typeof WIDGET_AMBIENT_SOUNDS)[number];

const MAX_SLEEP_MINUTES = 240;

function isAmbientSound(value: unknown): value is WidgetAmbientSound {
  return WIDGET_AMBIENT_SOUNDS.some(s => s === value);
}

export type WidgetCommand =
  // Absolute target state: the widget sends the opposite of what it rendered.
  | {type: 'setPlayback'; playing: boolean}
  | {
      type: 'playTrack';
      surahId: number;
      reciterId: string | null; // null means default reciter
      rewayatId: string | null;
      ayah: number | null; // start from this ayah when timestamps exist
    }
  | {type: 'playReciter'; reciterId: string}
  // Queue a playlist starting at itemId (null: the first item).
  | {type: 'playPlaylist'; playlistId: string; itemId: string | null}
  // Play a surah from the start, set the sleep timer, optionally start ambient.
  | {
      type: 'startBedtime';
      surahId: number;
      reciterId: string | null; // null means default reciter
      sleepMinutes: number;
      ambient: WidgetAmbientSound | null; // null leaves ambient alone
    };

export interface QueuedWidgetCommand {
  command: WidgetCommand;
  enqueuedAt: number;
}

const DEFAULT_MAX_AGE_MS = 60_000;

export function isWidgetCommand(value: unknown): value is WidgetCommand {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'setPlayback':
      return typeof value.playing === 'boolean';
    case 'playTrack':
      return (
        typeof value.surahId === 'number' &&
        Number.isInteger(value.surahId) &&
        value.surahId >= 1 &&
        value.surahId <= 114 &&
        isNullableString(value.reciterId) &&
        isNullableString(value.rewayatId) &&
        (value.ayah === null ||
          (typeof value.ayah === 'number' &&
            Number.isInteger(value.ayah) &&
            value.ayah >= 1))
      );
    case 'playReciter':
      return typeof value.reciterId === 'string' && value.reciterId.length > 0;
    case 'playPlaylist':
      return (
        typeof value.playlistId === 'string' &&
        value.playlistId.length > 0 &&
        isNullableString(value.itemId)
      );
    case 'startBedtime':
      return (
        typeof value.surahId === 'number' &&
        Number.isInteger(value.surahId) &&
        value.surahId >= 1 &&
        value.surahId <= 114 &&
        isNullableString(value.reciterId) &&
        typeof value.sleepMinutes === 'number' &&
        Number.isInteger(value.sleepMinutes) &&
        value.sleepMinutes >= 1 &&
        value.sleepMinutes <= MAX_SLEEP_MINUTES &&
        (value.ambient === null || isAmbientSound(value.ambient))
      );
    default:
      return false;
  }
}

function isQueuedCommand(value: unknown): value is QueuedWidgetCommand {
  return (
    isRecord(value) &&
    typeof value.enqueuedAt === 'number' &&
    isWidgetCommand(value.command)
  );
}

export function parseQueuedCommands(json: string): QueuedWidgetCommand[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isQueuedCommand);
}

export function selectFreshCommands(
  queued: QueuedWidgetCommand[],
  now: number,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): WidgetCommand[] {
  const fresh = queued
    .filter(q => now - q.enqueuedAt <= maxAgeMs)
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
    .map(q => q.command);

  // The last play command wins. The last setPlayback wins too, but only
  // when it came after that play command (a pause tapped after a row tap).
  let lastPlay = -1;
  let lastSet = -1;
  fresh.forEach((c, i) => {
    if (c.type === 'setPlayback') lastSet = i;
    else lastPlay = i;
  });
  const selected: WidgetCommand[] = [];
  if (lastPlay >= 0) selected.push(fresh[lastPlay]);
  if (lastSet > lastPlay) selected.push(fresh[lastSet]);
  return selected;
}
