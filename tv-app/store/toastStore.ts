import {create} from 'zustand';

/** How long a toast stays up. */
export const TOAST_MS = 4500;

export type Toast = {
  id: number;
  message: string;
  /** 'error' for something that failed, 'info' for a confirmation. */
  kind: 'info' | 'error';
};

type State = {
  toast: Toast | null;
  show: (message: string, kind?: Toast['kind']) => void;
  hide: () => void;
};

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * One short message at the bottom of the screen, for feedback that has no
 * screen of its own: a press that could not play, a failure after leaving
 * the player. A new toast replaces the one showing. Never focusable, so it
 * can't trap focus.
 */
export const useToastStore = create<State>(set => ({
  toast: null,
  show: (message, kind = 'info') => {
    if (timer !== null) clearTimeout(timer);
    const id = nextId++;
    set({toast: {id, message, kind}});
    timer = setTimeout(() => {
      timer = null;
      set(s => (s.toast?.id === id ? {toast: null} : s));
    }, TOAST_MS);
  },
  hide: () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    set({toast: null});
  },
}));

export function showToast(message: string, kind?: Toast['kind']): void {
  useToastStore.getState().show(message, kind);
}
