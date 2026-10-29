import {verseEndCheck, verseFallbackNote} from './playback';
import type {VerseSpan} from '../verseTimeline';

describe('verseFallbackNote', () => {
  it('names the reciter and the surah', () => {
    expect(verseFallbackNote('Mishary Alafasy', 'Al-Baqarah')).toBe(
      'Mishary Alafasy has no verse timings for Al-Baqarah, so it plays from the start.',
    );
  });
});

describe('verseEndCheck', () => {
  const span: VerseSpan = {ayah: 2, fromMs: 10_000, toMs: 20_000};

  it('is gone on another track', () => {
    expect(verseEndCheck(span, 15_000, false)).toBe('gone');
  });

  it('plays inside the verse and ends past it', () => {
    expect(verseEndCheck(span, 15_000, true)).toBe('playing');
    expect(verseEndCheck(span, 20_500, true)).toBe('end');
  });

  it('is gone after a seek well outside the verse', () => {
    expect(verseEndCheck(span, 2_000, true)).toBe('gone');
    expect(verseEndCheck(span, 40_000, true)).toBe('gone');
  });
});
