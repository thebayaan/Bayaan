import {verseEndCheck, verseFallbackNote, within} from './playback';
import type {VerseSpan} from '../verseTimeline';

describe('within', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('gives what the promise resolved to in time', async () => {
    await expect(within(Promise.resolve(7), 400)).resolves.toBe(7);
    await expect(within(Promise.resolve(null), 400)).resolves.toBeNull();
  });

  it('gives undefined when the promise is slower, which still resolves', async () => {
    let finish: (v: number) => void = () => undefined;
    const slow = new Promise<number>(r => (finish = r));
    const got = within(slow, 400);
    jest.advanceTimersByTime(400);
    await expect(got).resolves.toBeUndefined();
    finish(3);
    await expect(slow).resolves.toBe(3);
  });

  it('gives undefined for a failure', async () => {
    await expect(
      within(Promise.reject(new Error('x')), 400),
    ).resolves.toBeUndefined();
  });
});

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
