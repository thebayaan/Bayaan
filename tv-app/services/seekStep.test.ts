import {createSeekStepper, SEEK_STREAK_MS} from './seekStep';

describe('createSeekStepper', () => {
  it('moves 15 s for a single press', () => {
    let t = 0;
    const step = createSeekStepper(() => t);
    expect(step(1)).toBe(15);
    t += 5000;
    expect(step(-1)).toBe(-15);
  });

  it('grows the step while presses keep coming quickly', () => {
    let t = 0;
    const step = createSeekStepper(() => t);
    const steps: number[] = [];
    for (let i = 0; i < 9; i++) {
      steps.push(step(1));
      t += 300;
    }
    expect(steps).toEqual([15, 15, 30, 30, 60, 60, 120, 120, 120]);
  });

  it('starts over after a pause or a change of direction', () => {
    let t = 0;
    const step = createSeekStepper(() => t);
    step(1);
    t += 100;
    step(1);
    t += 100;
    expect(step(1)).toBe(30);
    t += 100;
    expect(step(-1)).toBe(-15);
    t += SEEK_STREAK_MS + 1;
    expect(step(-1)).toBe(-15);
  });
});
