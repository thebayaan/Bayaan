import {create} from 'zustand';
import type {
  PracticeTarget,
  PracticeVerdict,
} from '@/services/recitation/practice/types';

export type PracticeStatus =
  | 'idle'
  | 'downloading'
  | 'loading'
  | 'listening'
  | 'paused'
  | 'done'
  | 'error';

export type PracticeErrorCode =
  | 'permission'
  | 'download'
  | 'mic'
  | 'interrupted'
  | 'other';

export interface PracticeState {
  status: PracticeStatus;
  /** Model download progress, 0 to 1, while status is 'downloading'. */
  downloadProgress: number;
  target: PracticeTarget | null;
  /** The ayah being recited, once the engine has placed it. */
  current: {surah: number; ayah: number} | null;
  /** Set when the take is done. */
  verdict: PracticeVerdict | null;
  error: {code: PracticeErrorCode; detail: string} | null;
}

export const PRACTICE_IDLE: PracticeState = {
  status: 'idle',
  downloadProgress: 0,
  target: null,
  current: null,
  verdict: null,
  error: null,
};

/** Written only by PracticeService. */
export const usePracticeStore = create<PracticeState>(() => PRACTICE_IDLE);
