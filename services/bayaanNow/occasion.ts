// @ai-generated
// A Bayaan Now occasion from the backend: a key date (Laylat al-Qadr, the
// Day of Arafah, Eid…) with a start and an end, and up to two slots that
// set what plays in each place, how it looks and what it says. Anything
// that can't be used is dropped, so a bad payload falls back to the rules.
//
// Expected shape:
// {
//   "id": "laylat-al-qadr-1448",
//   "startsAt": "2027-03-04T18:00:00Z",
//   "endsAt": "2027-03-05T04:00:00Z",
//   "slots": [
//     {
//       "action": {"kind": "surah", "surahId": 97},
//       "look": {"kind": "sky", "preset": "ramadan"},
//       "content": {"label": {"en": "Tonight", "ar": "الليلة"},
//                   "title": {"en": "Seek Laylat al-Qadr", "ar": "تحرَّ ليلة القدر"}}
//     },
//     {"look": {"kind": "image", "uri": "https://…", "scrim": 0.4}}
//   ]
// }
// A slot without an action restyles whatever the rules put in its place.
import type {NowAction, NowSlot} from './moments';
import {parseContent, parseLook} from './look';

export interface NowOccasion {
  id: string;
  startsAt: Date;
  endsAt: Date;
  slots: NowSlot[];
}

function parseAction(value: unknown): NowAction | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case 'surah':
      if (
        typeof v.surahId !== 'number' ||
        !Number.isInteger(v.surahId) ||
        v.surahId < 1 ||
        v.surahId > 114
      ) {
        return undefined;
      }
      return {
        kind: 'surah',
        surahId: v.surahId,
        reciterId: typeof v.reciterId === 'string' ? v.reciterId : undefined,
        rewayatId: typeof v.rewayatId === 'string' ? v.rewayatId : undefined,
      };
    case 'adhkar':
      return typeof v.superId === 'string'
        ? {kind: 'adhkar', superId: v.superId}
        : undefined;
    case 'playlist':
      return typeof v.playlistId === 'string'
        ? {kind: 'playlist', playlistId: v.playlistId}
        : undefined;
    default:
      return undefined;
  }
}

function parseSlot(value: unknown): NowSlot {
  if (!value || typeof value !== 'object') return {};
  const v = value as Record<string, unknown>;
  const slot: NowSlot = {};
  const action = parseAction(v.action);
  const look = parseLook(v.look);
  const content = parseContent(v.content);
  if (action) slot.action = action;
  if (look) slot.look = look;
  if (content) slot.content = content;
  return slot;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** An occasion from the backend, or null when it can't be used. */
export function parseOccasion(value: unknown): NowOccasion | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const startsAt = parseDate(v.startsAt);
  const endsAt = parseDate(v.endsAt);
  if (typeof v.id !== 'string' || !startsAt || !endsAt) return null;
  if (endsAt <= startsAt || !Array.isArray(v.slots)) return null;
  const slots = v.slots.slice(0, 2).map(parseSlot);
  if (slots.every(s => !s.action && !s.look && !s.content)) return null;
  return {id: v.id, startsAt, endsAt, slots};
}

/** The slots while the occasion is on, else none. */
export function activeSlots(
  occasion: NowOccasion | null,
  now: Date,
): NowSlot[] | null {
  if (!occasion) return null;
  if (now < occasion.startsAt || now >= occasion.endsAt) return null;
  return occasion.slots;
}
