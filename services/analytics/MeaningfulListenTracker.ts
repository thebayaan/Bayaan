import {MeaningfulListenProps} from './events';

interface TrackInfo {
  surahId: number;
  reciterId: string;
  rewayahId: string;
  totalDurationMs: number;
}

export class MeaningfulListenTracker {
  private currentTrack: TrackInfo | null = null;
  private thresholdMs: number = 0;
  private hasFired: boolean = false;
  private readonly onMeaningfulListen: (props: MeaningfulListenProps) => void;

  constructor(onMeaningfulListen: (props: MeaningfulListenProps) => void) {
    this.onMeaningfulListen = onMeaningfulListen;
  }

  startTracking(track: TrackInfo): void {
    this.currentTrack = track;
    this.thresholdMs = Math.min(30000, track.totalDurationMs * 0.1);
    this.hasFired = false;
  }

  updateProgress(positionMs: number): void {
    if (this.currentTrack === null || this.hasFired) return;

    if (positionMs >= this.thresholdMs) {
      this.hasFired = true;
      this.onMeaningfulListen({
        surah_id: this.currentTrack.surahId,
        reciter_id: this.currentTrack.reciterId,
        rewayah_id: this.currentTrack.rewayahId,
      });
    }
  }

  stopTracking(): void {
    this.currentTrack = null;
    this.hasFired = false;
  }
}
