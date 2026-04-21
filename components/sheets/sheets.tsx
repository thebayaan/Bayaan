import React from 'react';
import {SheetDefinition, registerSheet} from 'react-native-actions-sheet';
import {Surah} from '@/data/surahData';
import type {RewayatStyle} from '@/types/reciter';
import type {Dhikr} from '@/types/adhkar';
import type {UploadedRecitation} from '@/types/uploads';

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
import {AdhkarLayoutSheet} from './AdhkarLayoutSheet';
import {AdhkarCopyOptionsSheet} from './AdhkarCopyOptionsSheet';
import {OrganizeRecitationSheet} from './OrganizeRecitationSheet';
import {DownloadOptionsSheet} from './DownloadOptionsSheet';
import {UploadOptionsSheet} from './UploadOptionsSheet';
import {AddToCollectionSheet} from './AddToCollectionSheet';
import {AmbientSoundsSheet} from './AmbientSoundsSheet';
import {CollectionOptionsSheet} from './CollectionOptionsSheet';
import {VerseActionsSheet} from './VerseActionsSheet';
import {VerseCopySheet} from './VerseCopySheet';
import {VerseHighlightSheet} from './VerseHighlightSheet';
import {VerseNoteSheet} from './VerseNoteSheet';
import {VerseShareSheet} from './VerseShareSheet';
import {SimilarVersesSheet} from './SimilarVersesSheet';
import {MushafPlayerOptionsSheet} from './MushafPlayerOptionsSheet';
import {MushafRepeatOptionsSheet} from './MushafRepeatOptionsSheet';
import {FollowAlongSheet} from './FollowAlongSheet';
import {WordDetailSheet} from './WordDetailSheet';
import {HomeCardOptionsSheet} from './HomeCardOptionsSheet';

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
registerSheet('adhkar-layout', AdhkarLayoutSheet);
registerSheet('adhkar-copy-options', AdhkarCopyOptionsSheet);
registerSheet('organize-recitation', OrganizeRecitationSheet);
registerSheet('download-options', DownloadOptionsSheet);
registerSheet('upload-options', UploadOptionsSheet);
registerSheet('add-to-collection', AddToCollectionSheet);
registerSheet('ambient-sounds', AmbientSoundsSheet);
registerSheet('collection-options', CollectionOptionsSheet);
registerSheet('verse-actions', VerseActionsSheet);
registerSheet('verse-copy', VerseCopySheet);
registerSheet('verse-highlight', VerseHighlightSheet);
registerSheet('verse-note', VerseNoteSheet);
registerSheet('verse-share', VerseShareSheet);
registerSheet('similar-verses', SimilarVersesSheet);
registerSheet('mushaf-player-options', MushafPlayerOptionsSheet);
registerSheet('mushaf-repeat-options', MushafRepeatOptionsSheet);
registerSheet('follow-along', FollowAlongSheet);
registerSheet('word-detail', WordDetailSheet);
registerSheet('home-card-options', HomeCardOptionsSheet);

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
        hideGoToReciter?: boolean;
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
    'mushaf-layout': SheetDefinition<{
      payload?: {
        context?: 'mushaf' | 'player';
      };
    }>;
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
    'verse-actions': SheetDefinition<{
      payload: {
        verseKey: string;
        surahNumber: number;
        ayahNumber: number;
        verseKeys?: string[];
        arabicText?: string;
        translation?: string;
        transliteration?: string;
        source?: 'player' | 'mushaf';
        // Override the rewayah used for Arabic text resolution and share
        // disclosure. Defaults to the mushaf's active rewayah.
        rewayah?: import('@/store/mushafSettingsStore').RewayahId;
      };
    }>;
    'verse-copy': SheetDefinition<{
      payload: {
        verseKey: string;
        surahNumber: number;
        ayahNumber: number;
        verseKeys?: string[];
        arabicText: string;
        translation: string;
        transliteration?: string;
      };
    }>;
    'verse-highlight': SheetDefinition<{
      payload: {
        verseKey: string;
        surahNumber: number;
        ayahNumber: number;
        verseKeys?: string[];
        rewayah?: import('@/store/mushafSettingsStore').RewayahId;
      };
    }>;
    'verse-note': SheetDefinition<{
      payload: {
        verseKey: string;
        surahNumber: number;
        ayahNumber: number;
        verseKeys?: string[];
        noteId?: string;
        rewayah?: import('@/store/mushafSettingsStore').RewayahId;
      };
    }>;
    'verse-share': SheetDefinition<{
      payload: {
        verseKey: string;
        surahNumber: number;
        ayahNumber: number;
        verseKeys?: string[];
        arabicText?: string;
        translation?: string;
      };
    }>;
    'similar-verses': SheetDefinition<{
      payload: {
        verseKey: string;
        surahNumber: number;
        ayahNumber: number;
        section?: 'similar' | 'phrases';
      };
    }>;
    'mushaf-player-options': SheetDefinition<{
      payload: {
        currentPage: number;
      };
    }>;
    'mushaf-repeat-options': SheetDefinition<{
      payload: {
        verseKey: string;
        verseKeys?: string[];
        page: number;
        surahNumber: number;
      };
    }>;
    'follow-along': SheetDefinition;
    'word-detail': SheetDefinition<{
      payload: {
        verseKey: string;
        position: number;
      };
    }>;
    'home-card-options': SheetDefinition<{
      payload: {
        reciterId: string;
        reciterName: string;
        surahId?: number;
        surahName?: string;
        rewayatId?: string;
        recentIndex?: number;
        variant: 'recent' | 'reciter';
        onContinuePlaying?: () => void;
      };
    }>;
  }
}

export {};
