// services/adhkar/playback/types.ts
// Adhkar playback session: one list playing (or paused, or saved) app-wide.

export interface SessionItem {
  dhikrId: string;
  audioFile: string | null;
  // False when the row has no bundled audio; such rows are skipped.
  playable: boolean;
  // First 60 characters of the clean Arabic (Live Activity, Plan B).
  preview: string;
}

export interface SessionSource {
  listId: string; // superId, or 'saved'
  listTitle: string; // already localized, as the list screen shows it
  items: SessionItem[];
}

export type SessionStatus = 'loading' | 'playing' | 'paused';
export type SessionMode = 'single' | 'all';

export interface AdhkarSession extends SessionSource {
  index: number;
  mode: SessionMode;
  loop: boolean;
  status: SessionStatus;
  error: boolean;
  trackToken: number;
  positionSec: number;
  // @ai-start
  // Length of the current clip, saved together with positionSec so the
  // progress bar can show a paused or restored position before the clip is
  // loaded again. Absent until the clip has been paused once.
  durationSec?: number;
  // @ai-end
  lastActiveAt: number;
}

export type SessionEvent =
  // @ai-start
  // loop: Repeat was switched on in the reader before this dhikr played. It
  // only counts when the press starts a new single-dhikr session.
  | {type: 'pressCard'; source: SessionSource; index: number; loop?: boolean}
  // @ai-end
  | {type: 'pressPlayAll'; source: SessionSource}
  // The dhikr id, not a screen index: the reader's list can drift from the
  // session's items (an unsaved row leaves the Saved reader).
  | {type: 'swipedTo'; listId: string; dhikrId: string}
  // Next / previous on the lock screen or in the car: like a swipe, but it
  // always plays the dhikr it lands on, even from a paused session.
  | {type: 'trackSkipped'; listId: string; dhikrId: string}
  | {type: 'toggle'}
  | {type: 'stop'}
  | {type: 'toggleLoop'}
  | {type: 'trackEnded'; token: number}
  | {type: 'playStarted'; token: number}
  | {type: 'playFailed'; token: number}
  | {type: 'playerPaused'}
  | {type: 'playerResumed'}
  | {type: 'otherAudioStarted'}
  | {type: 'positionSaved'; positionSec: number; durationSec?: number} // @ai
  | {type: 'restored'; session: AdhkarSession};

export interface SavedSession {
  listId: string;
  listTitle: string;
  mode: SessionMode;
  loop: boolean;
  dhikrId: string;
  positionSec: number;
  durationSec?: number; // @ai
  lastActiveAt: number;
}
