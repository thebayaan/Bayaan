import {wakesAtStep1, wakesSecondJudge} from '../wake';
import type {VerdictChange} from '../../wordMarks';

function change(
  state: VerdictChange['state'],
  extra: Partial<VerdictChange> = {},
): VerdictChange {
  return {surah: 2, ayah: 5, word: 3, totalWords: 9, state, ...extra};
}

describe('Step 1', () => {
  it('wakes on wrong and skipped only', () => {
    expect(wakesSecondJudge(change('wrong'))).toBe(true);
    expect(wakesSecondJudge(change('skipped'))).toBe(true);
    expect(wakesSecondJudge(change('unsure'))).toBe(false);
    expect(wakesSecondJudge(change('ok', {detail: {gop: -9}}))).toBe(false);
    expect(wakesSecondJudge(change('pending'))).toBe(false);
  });

  it('a skipped verdict already known to be said still wakes it', () => {
    const said = change('skipped', {detail: {junctionMissing: false}});
    expect(wakesSecondJudge(said)).toBe(true);
  });

  it('news about a word does not, nor a junction mark', () => {
    const repeat = change('skipped', {
      repeat: true,
      detail: {junctionMissing: false},
    });
    expect(wakesSecondJudge(repeat)).toBe(false);
    const unsaid = change('skipped', {detail: {junctionMissing: true}});
    expect(wakesSecondJudge(unsaid)).toBe(false);
    const carrying = change('wrong', {repeat: true});
    expect(wakesSecondJudge(carrying)).toBe(false);
  });
});

describe('Step 2', () => {
  const step2 = (c: VerdictChange) => wakesSecondJudge(c, true);

  it('also wakes on unsure', () => {
    expect(step2(change('unsure'))).toBe(true);
  });

  it('also wakes on ok with a low gop', () => {
    expect(step2(change('ok', {detail: {gop: -1.5}}))).toBe(true);
    expect(step2(change('ok', {detail: {gop: -1.4}}))).toBe(false);
  });

  it('also wakes on ok with no gop and some distance', () => {
    expect(step2(change('ok', {detail: {gop: null, distance: 0.1}}))).toBe(
      true,
    );
    expect(step2(change('ok', {detail: {gop: null, distance: 0}}))).toBe(false);
    expect(step2(change('ok'))).toBe(false);
  });

  it('still ignores news and pending words', () => {
    expect(step2(change('unsure', {repeat: true}))).toBe(false);
    expect(step2(change('pending'))).toBe(false);
  });
});

describe('the phone switch', () => {
  function loadWith(step: number): typeof import('../wake') {
    let wake: typeof import('../wake') | undefined;
    jest.isolateModules(() => {
      jest.doMock('@/services/recitation/secondLook/config', () => ({
        ...jest.requireActual('@/services/recitation/secondLook/config'),
        JUDGE_STEP: step,
      }));
      wake = require('../wake');
      jest.dontMock('@/services/recitation/secondLook/config');
    });
    return wake as typeof import('../wake');
  }

  it('Step 1 leaves unsure alone', () => {
    expect(loadWith(1).wakesSecondJudge(change('unsure'))).toBe(false);
  });

  it('Step 2 wakes on it', () => {
    expect(loadWith(2).wakesSecondJudge(change('unsure'))).toBe(true);
  });

  it('as shipped, it is Step 1', () => {
    expect(wakesSecondJudge(change('unsure'))).toBe(false);
  });

  it('names what Step 1 wakes on', () => {
    expect(wakesAtStep1('wrong')).toBe(true);
    expect(wakesAtStep1('skipped')).toBe(true);
    expect(wakesAtStep1('unsure')).toBe(false);
    expect(wakesAtStep1('ok')).toBe(false);
  });
});
