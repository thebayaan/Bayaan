import {PlayerColors, CachedReciterColors} from '@/utils/playerColorUtils';

export interface PlayerColorState {
  colors: PlayerColors | null;
  cachedColors: {
    [reciterName: string]: CachedReciterColors;
  };
}

export interface PlayerColorActions {
  setColors: (colors: PlayerColors) => void;
  setCachedColors: (reciterName: string, colors: CachedReciterColors) => void;
  clearCachedColors: () => void;
}
