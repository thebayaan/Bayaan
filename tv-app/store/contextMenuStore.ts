import {create} from 'zustand';

type State = {
  reciterId: string | null;
  open: (id: string) => void;
  close: () => void;
};

export const useContextMenuStore = create<State>(set => ({
  reciterId: null,
  open: id => set({reciterId: id}),
  close: () => set({reciterId: null}),
}));
