import {CORRUPT_LOGP_FLOOR, corruptRow} from '../corruptOutput';

const TOKENS = 31;

function output(frames: number, fill = -3): Float32Array {
  return new Float32Array(frames * TOKENS).fill(fill);
}

describe('corruptRow', () => {
  it('is -1 for clean output, very unlikely tokens included', () => {
    const logp = output(40);
    logp[5 * TOKENS + 7] = -60;
    logp[39 * TOKENS + 30] = CORRUPT_LOGP_FLOOR;
    expect(corruptRow(logp, 40)).toBe(-1);
  });

  it('names the first row that goes below the floor', () => {
    const logp = output(70);
    logp[31 * TOKENS] = 0;
    logp.fill(-4e5, 31 * TOKENS + 1, 32 * TOKENS);
    logp[63 * TOKENS + 4] = -4e5;
    expect(corruptRow(logp, 70)).toBe(31);
  });

  it('finds a bad value in the last column of the last row', () => {
    const logp = output(3);
    logp[3 * TOKENS - 1] = -1001;
    expect(corruptRow(logp, 3)).toBe(2);
  });

  it('is -1 when there are no frames', () => {
    expect(corruptRow(new Float32Array(0), 0)).toBe(-1);
  });
});
