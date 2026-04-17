import {MeaningfulListenTracker} from '../MeaningfulListenTracker';

describe('MeaningfulListenTracker', () => {
  let tracker: MeaningfulListenTracker;
  let onMeaningfulListen: jest.Mock;

  beforeEach(() => {
    onMeaningfulListen = jest.fn();
    tracker = new MeaningfulListenTracker(onMeaningfulListen);
  });

  describe('startTracking', () => {
    it('resets state and does not fire callback', () => {
      tracker.startTracking({
        surahId: 1,
        reciterId: 'reciter-1',
        rewayahId: 'rewayah-1',
        totalDurationMs: 600000,
      });

      expect(onMeaningfulListen).not.toHaveBeenCalled();
    });

    it('resets hasFired so a new track can fire again', () => {
      // First track
      tracker.startTracking({
        surahId: 1,
        reciterId: 'reciter-1',
        rewayahId: 'rewayah-1',
        totalDurationMs: 600000,
      });
      tracker.updateProgress(30000); // fires
      expect(onMeaningfulListen).toHaveBeenCalledTimes(1);

      // Second track — should be able to fire again
      tracker.startTracking({
        surahId: 2,
        reciterId: 'reciter-1',
        rewayahId: 'rewayah-1',
        totalDurationMs: 600000,
      });
      tracker.updateProgress(30000); // fires again
      expect(onMeaningfulListen).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateProgress', () => {
    it('fires at 30s for long tracks (>5 min)', () => {
      // 10-minute track: threshold = min(30000, 60000) = 30000ms
      tracker.startTracking({
        surahId: 1,
        reciterId: 'reciter-1',
        rewayahId: 'rewayah-1',
        totalDurationMs: 600000,
      });

      tracker.updateProgress(29999);
      expect(onMeaningfulListen).not.toHaveBeenCalled();

      tracker.updateProgress(30000);
      expect(onMeaningfulListen).toHaveBeenCalledTimes(1);
      expect(onMeaningfulListen).toHaveBeenCalledWith({
        surah_id: 1,
        reciter_id: 'reciter-1',
        rewayah_id: 'rewayah-1',
      });
    });

    it('fires at 10% for short tracks (<5 min)', () => {
      // 40-second track: threshold = min(30000, 4000) = 4000ms
      tracker.startTracking({
        surahId: 2,
        reciterId: 'reciter-2',
        rewayahId: 'rewayah-2',
        totalDurationMs: 40000,
      });

      tracker.updateProgress(3999);
      expect(onMeaningfulListen).not.toHaveBeenCalled();

      tracker.updateProgress(4000);
      expect(onMeaningfulListen).toHaveBeenCalledTimes(1);
      expect(onMeaningfulListen).toHaveBeenCalledWith({
        surah_id: 2,
        reciter_id: 'reciter-2',
        rewayah_id: 'rewayah-2',
      });
    });

    it('only fires once per track', () => {
      tracker.startTracking({
        surahId: 1,
        reciterId: 'reciter-1',
        rewayahId: 'rewayah-1',
        totalDurationMs: 600000,
      });

      tracker.updateProgress(30000);
      tracker.updateProgress(60000);
      tracker.updateProgress(120000);

      expect(onMeaningfulListen).toHaveBeenCalledTimes(1);
    });

    it('does nothing if no track is being tracked', () => {
      tracker.updateProgress(30000);
      expect(onMeaningfulListen).not.toHaveBeenCalled();
    });
  });

  describe('stopTracking', () => {
    it('prevents future fires after stopTracking is called', () => {
      tracker.startTracking({
        surahId: 1,
        reciterId: 'reciter-1',
        rewayahId: 'rewayah-1',
        totalDurationMs: 600000,
      });

      tracker.stopTracking();
      tracker.updateProgress(30000);

      expect(onMeaningfulListen).not.toHaveBeenCalled();
    });

    it('clears state so a new track can be started', () => {
      tracker.startTracking({
        surahId: 1,
        reciterId: 'reciter-1',
        rewayahId: 'rewayah-1',
        totalDurationMs: 600000,
      });
      tracker.stopTracking();

      // Start a fresh track after stopping
      tracker.startTracking({
        surahId: 3,
        reciterId: 'reciter-3',
        rewayahId: 'rewayah-3',
        totalDurationMs: 600000,
      });
      tracker.updateProgress(30000);

      expect(onMeaningfulListen).toHaveBeenCalledTimes(1);
      expect(onMeaningfulListen).toHaveBeenCalledWith({
        surah_id: 3,
        reciter_id: 'reciter-3',
        rewayah_id: 'rewayah-3',
      });
    });
  });
});
