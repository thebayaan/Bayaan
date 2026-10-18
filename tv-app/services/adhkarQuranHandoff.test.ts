import {createQuranHandoff} from './adhkarQuranHandoff';

function setup(status: string) {
  let current = status;
  const resumeQuran = jest.fn();
  const handoff = createQuranHandoff({quranStatus: () => current, resumeQuran});
  const setStatus = (next: string): void => {
    current = next;
  };
  return {handoff, resumeQuran, setStatus};
}

describe('adhkar Quran handoff', () => {
  it('resumes the Quran a recitation paused', () => {
    const {handoff, resumeQuran, setStatus} = setup('playing');
    expect(handoff.wasPlaying).toBe(true);
    handoff.adhkarPlayed();
    setStatus('paused');
    expect(handoff.leave()).toBe(true);
    expect(resumeQuran).toHaveBeenCalledTimes(1);
  });

  it('leaves the Quran alone when no recitation played', () => {
    const {handoff, resumeQuran} = setup('playing');
    expect(handoff.leave()).toBe(false);
    expect(resumeQuran).not.toHaveBeenCalled();
  });

  it('never starts a Quran that was not playing', () => {
    const {handoff, resumeQuran} = setup('paused');
    handoff.adhkarPlayed();
    expect(handoff.leave()).toBe(false);
    expect(resumeQuran).not.toHaveBeenCalled();
  });

  it('does nothing when the Quran moved on meanwhile', () => {
    const {handoff, resumeQuran, setStatus} = setup('playing');
    handoff.adhkarPlayed();
    setStatus('error');
    expect(handoff.leave()).toBe(false);
    expect(resumeQuran).not.toHaveBeenCalled();
  });

  it('resumes once only', () => {
    const {handoff, resumeQuran, setStatus} = setup('playing');
    handoff.adhkarPlayed();
    setStatus('paused');
    handoff.leave();
    handoff.leave();
    expect(resumeQuran).toHaveBeenCalledTimes(1);
  });
});
