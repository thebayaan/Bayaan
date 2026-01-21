import {SheetDefinition, registerSheet} from 'react-native-actions-sheet';
import {Surah} from '@/data/surahData';
import type {RewayatStyle} from '@/types/reciter';

// Import sheet components
import {SurahOptionsSheet} from './SurahOptionsSheet';
import {RewayatInfoSheet} from './RewayatInfoSheet';
import {FavoriteRecitersSheet} from './FavoriteRecitersSheet';
import {SelectReciterSheet} from './SelectReciterSheet';
import {SelectPlaylistSheet} from './SelectPlaylistSheet';
import {CreatePlaylistSheet} from './CreatePlaylistSheet';
import {PlaylistContextSheet} from './PlaylistContextSheet';
import {PlayerOptionsSheet} from './PlayerOptionsSheet';
import {PlaybackSpeedSheet} from './PlaybackSpeedSheet';
import {SleepTimerSheet} from './SleepTimerSheet';
import {MushafLayoutSheet} from './MushafLayoutSheet';
import {ExtendedSummarySheet} from './ExtendedSummarySheet';

// Register all sheets
registerSheet('surah-options', SurahOptionsSheet);
registerSheet('rewayat-info', RewayatInfoSheet);
registerSheet('favorite-reciters', FavoriteRecitersSheet);
registerSheet('select-reciter', SelectReciterSheet);
registerSheet('select-playlist', SelectPlaylistSheet);
registerSheet('create-playlist', CreatePlaylistSheet);
registerSheet('playlist-context', PlaylistContextSheet);
registerSheet('player-options', PlayerOptionsSheet);
registerSheet('playback-speed', PlaybackSpeedSheet);
registerSheet('sleep-timer', SleepTimerSheet);
registerSheet('mushaf-layout', MushafLayoutSheet);
registerSheet('extended-summary', ExtendedSummarySheet);

// Type definitions for payloads
declare module 'react-native-actions-sheet' {
  interface Sheets {
    'surah-options': SheetDefinition<{
      payload: {
        surah: Surah;
        reciterId?: string;
        rewayatId?: string;
        onAddToQueue?: (surah: Surah) => Promise<void>;
      };
    }>;
    'rewayat-info': SheetDefinition<{
      payload: {
        rewayat: RewayatStyle[];
        selectedId?: string;
      };
      returnValue: string | undefined;
    }>;
    'favorite-reciters': SheetDefinition;
    'select-reciter': SheetDefinition<{
      payload: {
        surahId: string;
        source?: 'search' | 'home';
      };
    }>;
    'select-playlist': SheetDefinition<{
      payload: {
        surah: Surah;
        reciterId: string;
        rewayatId?: string;
      };
    }>;
    'playlist-context': SheetDefinition<{
      payload: {
        playlistId: string;
        playlistName: string;
        playlistColor?: string;
        onDelete: () => void;
        onEdit?: () => void;
      };
    }>;
    'create-playlist': SheetDefinition<{
      payload: {
        existingColors?: string[];
        isEditMode?: boolean;
        initialName?: string;
        initialColor?: string;
      };
      returnValue:
        | {
            name: string;
            color: string;
          }
        | undefined;
    }>;
    'player-options': SheetDefinition<{
      payload: {
        surah: Surah;
        reciterId: string;
        rewayatId?: string;
        onGoToReciter?: () => void;
      };
    }>;
    'playback-speed': SheetDefinition<{
      payload: {
        currentSpeed: number;
        onSpeedChange: (speed: number) => void;
      };
    }>;
    'sleep-timer': SheetDefinition<{
      payload: {
        sleepTimer: number;
        remainingTime: number | null;
        onTimerChange: (minutes: number) => void;
        onTurnOffTimer: () => void;
      };
    }>;
    'mushaf-layout': SheetDefinition;
    'extended-summary': SheetDefinition<{
      payload: {
        surahInfo: {
          surah_number: number;
          surah_name: string;
          text: string;
        };
      };
    }>;
  }
}

export {};
