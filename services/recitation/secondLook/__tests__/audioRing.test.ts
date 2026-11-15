import {createAudioRing} from '../audioRing';

const SR = 16000;

/** Samples numbered from `start`, so a slice shows exactly what it read. */
function counted(start: number, length: number): Float32Array {
  return Float32Array.from({length}, (_, i) => start + i);
}

describe('audio ring', () => {
  it('reads by sample number, and knows how much it has heard', () => {
    const ring = createAudioRing();
    expect(ring.heard()).toBe(0);
    ring.push(counted(0, SR));
    expect(ring.heard()).toBe(SR);
    expect(Array.from(ring.samples(1600, 1603))).toEqual([1600, 1601, 1602]);
    expect(ring.samples(SR - 1, SR + 5)).toHaveLength(1);
    ring.reset();
    expect(ring.heard()).toBe(0);
  });

  it('reads by seconds of the audio fed since the reset', () => {
    const ring = createAudioRing();
    ring.push(counted(0, SR));
    ring.push(counted(SR, SR));
    expect(Array.from(ring.slice(0.5, 0.5 + 3 / SR))).toEqual([
      SR / 2,
      SR / 2 + 1,
      SR / 2 + 2,
    ]);
  });

  it('rounds outwards, as the bench cut its slices', () => {
    const ring = createAudioRing();
    ring.push(counted(0, SR));
    // 0.10003 s is sample 1600.48 and 0.10011 s is sample 1601.76.
    expect(Array.from(ring.slice(0.10003, 0.10011))).toEqual([1600, 1601]);
  });

  it('clips to what has been fed, at both ends', () => {
    const ring = createAudioRing();
    ring.push(counted(0, SR));
    const slice = ring.slice(-4.6, 0.9 + 10);
    expect(slice.length).toBe(SR);
    expect(slice[0]).toBe(0);
    expect(slice[SR - 1]).toBe(SR - 1);
  });

  it('gives nothing before any audio, or for a range outside it', () => {
    const ring = createAudioRing();
    expect(ring.slice(0, 1).length).toBe(0);
    ring.push(counted(0, SR));
    expect(ring.slice(2, 3).length).toBe(0);
    expect(ring.slice(-2, -1).length).toBe(0);
    expect(ring.slice(0.5, 0.4).length).toBe(0);
  });

  it('keeps the last seconds, in order, across the wrap', () => {
    const ring = createAudioRing(1);
    ring.push(counted(0, SR));
    ring.push(counted(SR, SR / 2));
    const slice = ring.slice(0, 2);
    expect(slice.length).toBe(SR);
    expect(slice[0]).toBe(SR / 2);
    expect(slice[SR - 1]).toBe(SR + SR / 2 - 1);
    for (let i = 1; i < slice.length; i++) {
      expect(slice[i]).toBe(slice[i - 1] + 1);
    }
  });

  it('holds about 30 s by default', () => {
    const ring = createAudioRing();
    for (let s = 0; s < 40; s++) ring.push(counted(s * SR, SR));
    expect(ring.slice(9, 10.5).length).toBe(SR / 2);
    expect(ring.slice(9, 10.5)[0]).toBe(10 * SR);
    expect(ring.slice(38, 40)[0]).toBe(38 * SR);
  });

  it('takes a chunk longer than the whole ring', () => {
    const ring = createAudioRing(1);
    ring.push(counted(0, 3 * SR + 5));
    const slice = ring.slice(0, 4);
    expect(slice.length).toBe(SR);
    expect(slice[0]).toBe(2 * SR + 5);
    expect(slice[SR - 1]).toBe(3 * SR + 4);
    ring.push(counted(3 * SR + 5, 10));
    expect(ring.slice(3 + 5 / SR, 4)[0]).toBe(3 * SR + 5);
  });

  it('a slice is a copy', () => {
    const ring = createAudioRing(1);
    ring.push(counted(0, SR));
    const slice = ring.slice(0, 1);
    slice[0] = -1;
    ring.push(counted(SR, SR));
    expect(slice[1]).toBe(1);
    expect(ring.slice(1, 1 + 1 / SR)[0]).toBe(SR);
  });

  it('the reset starts the clock again and forgets the audio', () => {
    const ring = createAudioRing();
    ring.push(counted(0, SR));
    ring.reset();
    expect(ring.slice(0, 1).length).toBe(0);
    ring.push(counted(100, 10));
    expect(ring.slice(0, 1 / SR)[0]).toBe(100);
  });
});
