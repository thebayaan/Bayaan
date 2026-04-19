export type PlayerStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'error';

export interface QueueItem {
  reciterId: string;
  rewayahId?: string;
  surahNumber: number;
  audioUrl: string;
  title: string;
  subtitle: string;
}

export interface PlayerState {
  status: PlayerStatus;
  currentIndex: number;
  queue: QueueItem[];
  positionSeconds: number;
  durationSeconds: number;
}
