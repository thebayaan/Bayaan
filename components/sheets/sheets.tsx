import React, {Suspense} from 'react';
import {View} from 'react-native';
import {SheetDefinition, registerSheet} from 'react-native-actions-sheet';
import {Surah} from '@/data/surahData';
import type {RewayatStyle} from '@/types/reciter';
import type {Dhikr} from '@/types/adhkar';
import type {UploadedRecitation} from '@/types/uploads';

/**
 * Wraps a lazy-imported sheet component in React.lazy + Suspense.
 * Metro defers module *evaluation* until the dynamic import() resolves,
 * so none of these sheets (or their dependency trees) execute at startup.
 */
function lazySheet(
  importFn: () => Promise<any>,
  exportName: string,
): React.FC<any> {
  const LazyComponent = React.lazy(() =>
    importFn().then(mod => ({default: mod[exportName]})),
  );
  return (props: any) => (
    <Suspense fallback={<View />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

// Register all sheets with lazy imports
registerSheet(
  'surah-options',
  lazySheet(() => import('./SurahOptionsSheet'), 'SurahOptionsSheet'),
);
registerSheet(
  'favorite-reciters',
  lazySheet(() => import('./FavoriteRecitersSheet'), 'FavoriteRecitersSheet'),
);
registerSheet(
  'select-reciter',
  lazySheet(() => import('./SelectReciterSheet'), 'SelectReciterSheet'),
);
registerSheet(
  'select-playlist',
  lazySheet(() => import('./SelectPlaylistSheet'), 'SelectPlaylistSheet'),
);
registerSheet(
  'create-playlist',
  lazySheet(() => import('./CreatePlaylistSheet'), 'CreatePlaylistSheet'),
);
registerSheet(
  'playlist-context',
  lazySheet(() => import('./PlaylistContextSheet'), 'PlaylistContextSheet'),
);
registerSheet(
  'player-options',
  lazySheet(() => import('./PlayerOptionsSheet'), 'PlayerOptionsSheet'),
);
registerSheet(
  'playback-speed',
  lazySheet(() => import('./PlaybackSpeedSheet'), 'PlaybackSpeedSheet'),
);
registerSheet(
  'sleep-timer',
  lazySheet(() => import('./SleepTimerSheet'), 'SleepTimerSheet'),
);
registerSheet(
  'mushaf-layout',
  lazySheet(() => import('./MushafLayoutSheet'), 'MushafLayoutSheet'),
);
registerSheet(
  'adhkar-layout',
  lazySheet(() => import('./AdhkarLayoutSheet'), 'AdhkarLayoutSheet'),
);
registerSheet(
  'adhkar-copy-options',
  lazySheet(() => import('./AdhkarCopyOptionsSheet'), 'AdhkarCopyOptionsSheet'),
);
registerSheet(
  'organize-recitation',
  lazySheet(
    () => import('./OrganizeRecitationSheet'),
    'OrganizeRecitationSheet',
  ),
);
registerSheet(
  'download-options',
  lazySheet(() => import('./DownloadOptionsSheet'), 'DownloadOptionsSheet'),
);
registerSheet(
  'upload-options',
  lazySheet(() => import('./UploadOptionsSheet'), 'UploadOptionsSheet'),
);
registerSheet(
  'add-to-collection',
  lazySheet(() => import('./AddToCollectionSheet'), 'AddToCollectionSheet'),
);
registerSheet(
  'ambient-sounds',
  lazySheet(() => import('./AmbientSoundsSheet'), 'AmbientSoundsSheet'),
);
registerSheet(
  'collection-options',
  lazySheet(() => import('./CollectionOptionsSheet'), 'CollectionOptionsSheet'),
);

// Type definitions for payloads
declare module 'react-native-actions-sheet' {
  interface Sheets {
    'surah-options': SheetDefinition<{
      payload: {
        surah: Surah;
        reciterId?: string;
        rewayatId?: string;
        onAddToQueue?: (surah: Surah) => Promise<void>;
        onRemoveFromPlaylist?: () => void;
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
        userRecitationId?: string;
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
        surah?: Surah;
        reciterId?: string;
        rewayatId?: string;
        onGoToReciter?: () => void;
        isUserUpload?: boolean;
        userRecitationId?: string;
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
    'adhkar-layout': SheetDefinition;
    'adhkar-copy-options': SheetDefinition<{
      payload: {
        dhikr: Dhikr;
      };
    }>;
    'organize-recitation': SheetDefinition<{
      payload: {
        recitation: UploadedRecitation;
        prefillReciterId?: string;
      };
    }>;
    'download-options': SheetDefinition<{
      payload: {
        download: import('@/services/player/store/downloadStore').DownloadedSurah;
        surah: Surah;
        reciterId: string;
        rewayatId: string;
        onPlay: () => void;
        onAddToQueue: () => void;
        onRemoveDownload: () => void;
      };
    }>;
    'upload-options': SheetDefinition<{
      payload: {
        recitation: UploadedRecitation;
        reciterId: string;
        onPlay: () => void;
        onAddToQueue: () => void;
      };
    }>;
    'add-to-collection': SheetDefinition;
    'ambient-sounds': SheetDefinition;
    'collection-options': SheetDefinition<{
      payload: {
        title: string;
        subtitle?: string;
        options: Array<{
          label: string;
          icon: string;
          onPress: () => void;
          destructive?: boolean;
          disabled?: boolean;
          customIcon?: React.ReactNode;
        }>;
      };
    }>;
  }
}

export {};
