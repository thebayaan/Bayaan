// @ai-generated
import React, {useCallback, useMemo} from 'react';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
import {useTranslation} from 'react-i18next';
import type {Surah} from '@/data/surahData';
import {useLoved} from '@/hooks/useLoved';
import {
  useDownloadActions,
  useDownloadProgress,
  useIsDownloaded,
  useIsDownloadedWithRewayat,
  useIsDownloading,
} from '@/services/player/store/downloadSelectors';
import {downloadSurah} from '@/services/downloadService';
import {getReciterByIdSync} from '@/services/dataService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useUploadsStore} from '@/store/uploadsStore';
import {recitationShareUrl, shareUrl} from '@/utils/shareUtils';
import branding from '@/config/branding';
import {getSurahDisplayName} from '@/i18n/format';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {
  OptionsMenuView,
  useNativeOptionsMenu,
  type OptionsMenuProps,
} from './OptionsMenu';

export interface PlayerOptionsPayload {
  surah?: Surah;
  reciterId?: string;
  rewayatId?: string;
  onGoToReciter?: () => void;
  isUserUpload?: boolean;
  userRecitationId?: string;
  /** Open straight on "Learn about this surah" (from a native menu). */
  showInfo?: boolean;
}

/**
 * State and actions behind the player's options, shared by the sheet
 * (phones) and the native menu (tablets).
 */
export function usePlayerOptions(
  payload: PlayerOptionsPayload | undefined,
  close: () => void,
) {
  const {t} = useTranslation(['sheets', 'common']);
  const surah = payload?.surah;
  const reciterId = payload?.reciterId ?? '';
  const rewayatId = payload?.rewayatId;
  const onGoToReciter = payload?.onGoToReciter;
  const isUserUpload = payload?.isUserUpload ?? false;
  const userRecitationId = payload?.userRecitationId;
  const surahId = surah?.id?.toString() ?? '';

  const downloadId = useMemo(
    () =>
      rewayatId
        ? `${reciterId}-${surahId}-${rewayatId}`
        : `${reciterId}-${surahId}`,
    [reciterId, surahId, rewayatId],
  );

  const {isLoved, isLovedWithRewayat, toggleLoved} = useLoved();
  const downloadProgress = useDownloadProgress(downloadId);
  const isTrackDownloadedBase = useIsDownloaded(reciterId, surahId);
  const isTrackDownloadedRewayat = useIsDownloadedWithRewayat(
    reciterId,
    surahId,
    rewayatId || '',
  );
  const isTrackDownloaded = rewayatId
    ? isTrackDownloadedRewayat
    : isTrackDownloadedBase;
  const isCurrentlyDownloading = useIsDownloading(downloadId);
  const {setDownloading, addDownload, clearDownloading, setDownloadProgress} =
    useDownloadActions();

  // Loving only makes sense with a reciter and a surah.
  const canLove = !!reciterId && !!surahId;
  const isLovedState = canLove
    ? rewayatId
      ? isLovedWithRewayat(reciterId, surahId, rewayatId)
      : isLoved(reciterId, surahId)
    : false;

  const handleToggleLove = useCallback(() => {
    if (!reciterId) return;
    toggleLoved(reciterId, surahId, rewayatId || '');
  }, [reciterId, surahId, toggleLoved, rewayatId]);

  const handleDownload = useCallback(async () => {
    if (!reciterId || !surah) return;
    if (isTrackDownloaded || isCurrentlyDownloading) return;
    try {
      setDownloading(downloadId);
      const downloadResult = await downloadSurah(
        surah.id,
        reciterId,
        rewayatId,
        progress => {
          setDownloadProgress(downloadId, progress);
        },
      );
      addDownload({
        reciterId,
        surahId: surahId,
        rewayatId: rewayatId || '',
        filePath: downloadResult.filePath,
        fileSize: downloadResult.fileSize,
        downloadDate: Date.now(),
        status: 'completed',
      });
      clearDownloading(downloadId);
    } catch (error) {
      console.error('Download failed:', error);
      clearDownloading(downloadId);
    }
  }, [
    reciterId,
    surah,
    surahId,
    rewayatId,
    isTrackDownloaded,
    isCurrentlyDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
    setDownloadProgress,
    downloadId,
  ]);

  const handleAddToPlaylist = useCallback(() => {
    if (!reciterId || !surah) return;
    showSheet('select-playlist', {
      payload: {surah, reciterId, rewayatId},
    });
  }, [reciterId, surah, rewayatId]);

  const handleGoToReciter = useCallback(() => {
    close();
    onGoToReciter?.();
  }, [close, onGoToReciter]);

  const handleEditDetails = useCallback(() => {
    if (!userRecitationId) return;
    const rec = useUploadsStore.getState().getRecitationById(userRecitationId);
    if (!rec) return;
    close();
    setTimeout(() => {
      showSheet('organize-recitation', {
        payload: {recitation: rec},
      });
    }, 300);
  }, [userRecitationId, close]);

  const canShare = !!(reciterId && rewayatId && surah);
  const handleShare = useCallback(() => {
    if (!reciterId || !rewayatId || !surah) return;
    const reciter = getReciterByIdSync(reciterId);
    if (!reciter?.slug) return;
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (!rewayat) return;
    const surahNum = surah.id;
    const position = usePlayerStore.getState().playback.position;
    const timestampSec = position > 0 ? Math.floor(position) : undefined;
    const url = recitationShareUrl(
      reciter.slug,
      surahNum,
      rewayat.id,
      timestampSec,
    );
    shareUrl(
      url,
      t('options.shareListen', {surah: surahNum, appName: branding.appName}),
    );
  }, [reciterId, rewayatId, surah, t]);

  return {
    surah,
    reciterId,
    isUserUpload,
    canLove,
    isLovedState,
    isTrackDownloaded,
    isCurrentlyDownloading,
    downloadProgress,
    canShare,
    canGoToReciter: !!onGoToReciter,
    handleToggleLove,
    handleDownload,
    handleAddToPlaylist,
    handleGoToReciter,
    handleEditDetails,
    handleShare,
  };
}

// The menu closes itself when a row is chosen.
const noop = () => undefined;

function PlayerMenu({
  payload,
  ...props
}: OptionsMenuProps & {payload: PlayerOptionsPayload}) {
  const {t} = useTranslation(['sheets', 'common']);
  const o = usePlayerOptions(payload, noop);
  const entries: NativeMenuEntry[] = [];
  if (o.isUserUpload) {
    entries.push({
      id: 'edit',
      title: t('options.editDetails'),
      systemImage: 'pencil',
    });
  } else {
    entries.push({
      id: 'download',
      title: o.isCurrentlyDownloading
        ? t('options.downloading', {
            percent: Math.round(o.downloadProgress * 100),
          })
        : o.isTrackDownloaded
          ? t('options.downloaded')
          : t('common:actions.download'),
      systemImage: o.isTrackDownloaded
        ? 'checkmark.circle'
        : 'arrow.down.circle',
      disabled: o.isTrackDownloaded || o.isCurrentlyDownloading,
    });
  }
  if (o.surah && o.reciterId) {
    entries.push({
      id: 'collection',
      title: t('options.addToCollection'),
      systemImage: 'plus.circle',
    });
  }
  if (o.canLove) {
    entries.push({
      id: 'love',
      title: o.isLovedState
        ? t('options.removeFromLoved')
        : t('options.addToLoved'),
      systemImage: o.isLovedState ? 'heart.fill' : 'heart',
    });
  }
  if (o.canShare) {
    entries.push({
      id: 'share',
      title: t('common:actions.share'),
      systemImage: 'square.and.arrow.up',
    });
  }
  if (o.canGoToReciter) {
    entries.push({
      id: 'reciter',
      title: t('options.goToReciter'),
      systemImage: 'person',
    });
  }
  if (o.surah) {
    entries.push({
      id: 'info',
      title: t('options.learnAboutSurah'),
      systemImage: 'info.circle',
    });
  }

  const onSelect = (id: string) => {
    switch (id) {
      case 'edit':
        return o.handleEditDetails();
      case 'download':
        o.handleDownload();
        return;
      case 'collection':
        return o.handleAddToPlaylist();
      case 'love':
        return o.handleToggleLove();
      case 'share':
        return o.handleShare();
      case 'reciter':
        return o.handleGoToReciter();
      case 'info':
        showSheet('player-options', {
          payload: {...payload, showInfo: true},
        });
        return;
    }
  };

  return (
    <OptionsMenuView
      model={{
        title: o.surah ? getSurahDisplayName(o.surah) : undefined,
        entries,
        onSelect,
      }}
      {...props}
    />
  );
}

/**
 * The full player's ••• as a native menu on tablets. Renders nothing
 * elsewhere, so callers can always place it inside their button.
 */
export function PlayerOptionsMenu({
  payload,
  ...props
}: OptionsMenuProps & {payload: PlayerOptionsPayload | null}) {
  const enabled = useNativeOptionsMenu('tap');
  if (!enabled || !payload || (!payload.surah && !payload.isUserUpload)) {
    return null;
  }
  return <PlayerMenu payload={payload} {...props} />;
}
