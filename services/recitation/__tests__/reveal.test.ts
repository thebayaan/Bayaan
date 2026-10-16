import {nextRevealed, type RevealedWords} from '../reveal';

describe('nextRevealed', () => {
  it('reveals up to the frontier word', () => {
    const r = nextRevealed({}, null, '36:1', 0, 1);
    expect(r['36:1']).toEqual({count: 1, total: 1});
  });

  it('never hides a word again when the cursor steps back', () => {
    let r: RevealedWords = nextRevealed({}, null, '36:4', 3, 5);
    r = nextRevealed(r, '36:4', '36:4', 1, 5);
    expect(r['36:4'].count).toBe(4);
  });

  it('completes the previous ayah when the next one starts', () => {
    let r: RevealedWords = nextRevealed({}, null, '36:4', 2, 5);
    r = nextRevealed(r, '36:4', '36:5', 0, 7);
    expect(r['36:4']).toEqual({count: 5, total: 5});
    expect(r['36:5']).toEqual({count: 1, total: 7});
  });

  it('leaves a skipped-from ayah partly hidden after a jump', () => {
    let r: RevealedWords = nextRevealed({}, null, '36:4', 2, 5);
    r = nextRevealed(r, '36:4', '36:9', 0, 6);
    expect(r['36:4'].count).toBe(3);
  });

  it('returns the same object when nothing changes', () => {
    const r = nextRevealed({}, null, '1:1', 3, 4);
    expect(nextRevealed(r, '1:1', '1:1', 2, 4)).toBe(r);
  });
});
