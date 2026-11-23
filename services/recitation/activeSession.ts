/**
 * What the one recitation session is for, or null when none runs. Kept apart
 * from sessionRunner (which loads the model and the mic) so audio code can
 * check it cheaply. Only sessionRunner writes it.
 */
export type SessionPurpose = 'follow' | 'identify' | 'practice';

let purpose: SessionPurpose | null = null;

export function activeSessionPurpose(): SessionPurpose | null {
  return purpose;
}

/** For sessionRunner only. */
export function setActiveSessionPurpose(next: SessionPurpose | null): void {
  purpose = next;
}
