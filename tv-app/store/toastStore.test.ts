import {TOAST_MS, showToast, useToastStore} from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useToastStore.getState().hide();
  });
  afterEach(() => jest.useRealTimers());

  it('shows a toast and hides it after a while', () => {
    showToast("Couldn't play", 'error');
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Couldn't play",
      kind: 'error',
    });
    jest.advanceTimersByTime(TOAST_MS);
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('a new toast replaces the old one and gets its full time', () => {
    showToast('First');
    jest.advanceTimersByTime(TOAST_MS - 100);
    showToast('Second');
    jest.advanceTimersByTime(200);
    expect(useToastStore.getState().toast?.message).toBe('Second');
    jest.advanceTimersByTime(TOAST_MS);
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('defaults to info', () => {
    showToast('Saved');
    expect(useToastStore.getState().toast?.kind).toBe('info');
  });
});
