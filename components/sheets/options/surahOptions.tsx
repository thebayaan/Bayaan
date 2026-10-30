// @ai-generated
import React, {useCallback, useMemo, type ReactNode} from 'react';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
import {useTranslation} from 'react-i18next';
import type {Surah} from '@/data/surahData';
import {useLoved} from '@/hooks/useLoved';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {
  useDownloadActions,
  useDownloadProgress,
  useIsDownloaded,
  useIsDownloadedWithRewayat,
  useIsDownloading,
} from '@/services/player/store/downloadSelectors';
import {downloadSurah} from '@/services/downloadService';
import {getReciterByIdSync} from '@/services/dataService';
import {recitationShareUrl, shareUrl} from '@/utils/shareUtils';
import branding from '@/config/branding';
import {getSurahDisplayName} from '@/i18n/format';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {
  OptionsMenuView,
  useNativeOptionsMenu,
  type OptionsMenuModel,
  type OptionsMenuProps,
} from './OptionsMenu';
import {
  SurahOptionsContext,
  type SurahOptionsBuilder,
  type SurahOptionsContextValue,
} from './SurahOptionsContext';

export interface SurahOptionsPayload {
  surah: Surah;
  reciterId?: string;
  rewayatId?: string;
  onAddToQueue?: (surah: Surah) => Promise<void>;
  onRemoveFromPlaylist?: () => void;
  hideGoToReciter?: boolean;
  /** Open straight on "Learn about this surah" (from a native menu). */
  showInfo?: boolean;
}

/**
 * State and actions behind the surah options, shared by the sheet (phones)
 * and the native menu (tablets) so both do exactly the same thing.
 * `close` hides the sheet; the menu passes a no-op because it closes itself.
 */
export function useSurahOptions(
  payload: SurahOptionsPayload | undefined,
  close: () => void,
) {
  const {t} = useTranslation(['sheets', 'common']);
  const surah = payload?.surah;
  const reciterId = payload?.reciterId;
  const rewayatId = payload?.rewayatId;
  const onAddToQueue = payload?.onAddToQueue;
  const onRemoveFromPlaylist = payload?.onRemoveFromPlaylist;
  const surahId = surah?.id?.toString() ?? '';

  const downloadId = useMemo(
    () =>
      reciterId
        ? rewayatId
          ? `${reciterId}-${surahId}-${rewayatId}`
          : `${reciterId}-${surahId}`
        : '__none__',
    [reciterId, surahId, rewayatId],
  );

  const {navigateToReciterProfile} = useReciterNavigation();
  const {isLoved, isLovedWithRewayat, toggleLoved} = useLoved();
  const downloadProgress = useDownloadProgress(downloadId);
  const isTrackDownloadedBase = useIsDownloaded(
    reciterId || '__none__',
    surahId,
  );
  const isTrackDownloadedRewayat = useIsDownloadedWithRewayat(
    reciterId || '__none__',
    surahId,
    rewayatId || '',
  );
  const isTrackDownloaded = rewayatId
    ? isTrackDownloadedRewayat
    : isTrackDownloadedBase;
  const isCurrentlyDownloading = useIsDownloading(downloadId);
  const {setDownloading, addDownload, clearDownloading, setDownloadProgress} =
    useDownloadActions();

  const isLovedState = reciterId
    ? rewayatId
      ? isLovedWithRewayat(reciterId, surahId, rewayatId)
      : isLoved(reciterId, surahId)
    : false;

  const handleAddToQueue = useCallback(() => {
    close();
    if (onAddToQueue && surah) {
      onAddToQueue(surah).catch(error => {
        console.error('Error adding to queue:', error);
      });
    }
  }, [onAddToQueue, surah, close]);

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

  const handleGoToReciter = useCallback(() => {
    close();
    if (reciterId) navigateToReciterProfile(reciterId);
  }, [close, reciterId, navigateToReciterProfile]);

  const handleRemoveFromPlaylist = useCallback(() => {
    close();
    onRemoveFromPlaylist?.();
  }, [onRemoveFromPlaylist, close]);

  const handleAddToPlaylist = useCallback(() => {
    if (!reciterId || !surah) return;
    showSheet('select-playlist', {
      payload: {surah, reciterId, rewayatId},
    });
  }, [reciterId, surah, rewayatId]);

  const canShare = !!(reciterId && rewayatId);
  const handleShare = useCallback(() => {
    if (!reciterId || !rewayatId || !surah) return;
    const reciter = getReciterByIdSync(reciterId);
    if (!reciter?.slug) return;
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (!rewayat) return;
    const url = recitationShareUrl(reciter.slug, surah.id, rewayat.id);
    shareUrl(
      url,
      t('options.shareListenSurah', {
        surah: getSurahDisplayName(surah),
        appName: branding.appName,
      }),
    );
  }, [reciterId, rewayatId, surah, t]);

  return {
    surah,
    reciterId,
    isLovedState,
    isTrackDownloaded,
    isCurrentlyDownloading,
    downloadProgress,
    canShare,
    showGoToReciter: !!reciterId && !payload?.hideGoToReciter,
    canRemoveFromPlaylist: !!onRemoveFromPlaylist,
    handleAddToQueue,
    handleToggleLove,
    handleDownload,
    handleGoToReciter,
    handleRemoveFromPlaylist,
    handleAddToPlaylist,
    handleShare,
  };
}

// The menu closes itself when a row is chosen.
const noop = () => undefined;

function useSurahMenuModel(payload: SurahOptionsPayload): OptionsMenuModel {
  const {t} = useTranslation(['sheets', 'common']);
  const o = useSurahOptions(payload, noop);
  const entries: NativeMenuEntry[] = [
    {
      id: 'love',
      title: o.isLovedState
        ? t('options.removeFromLoved')
        : t('options.addToLoved'),
      systemImage: o.isLovedState ? 'heart.fill' : 'heart',
      disabled: !o.reciterId,
    },
    {
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
    },
    {
      id: 'queue',
      title: t('options.addToQueue'),
      systemImage: 'text.badge.plus',
    },
    {
      id: 'collection',
      title: t('options.addToCollection'),
      systemImage: 'plus.circle',
    },
  ];
  if (o.canShare) {
    entries.push({
      id: 'share',
      title: t('common:actions.share'),
      systemImage: 'square.and.arrow.up',
    });
  }
  if (o.showGoToReciter) {
    entries.push({
      id: 'reciter',
      title: t('options.goToReciter'),
      systemImage: 'person',
    });
  }
  entries.push({
    id: 'info',
    title: t('options.learnAboutSurah'),
    systemImage: 'info.circle',
  });
  if (o.canRemoveFromPlaylist) {
    entries.push({
      id: 'remove',
      items: [
        {
          id: 'remove',
          title: t('options.removeFromPlaylist'),
          systemImage: 'minus.circle',
          destructive: true,
        },
      ],
    });
  }

  const onSelect = (id: string) => {
    switch (id) {
      case 'love':
        return o.handleToggleLove();
      case 'download':
        o.handleDownload();
        return;
      case 'queue':
        return o.handleAddToQueue();
      case 'collection':
        return o.handleAddToPlaylist();
      case 'share':
        return o.handleShare();
      case 'reciter':
        return o.handleGoToReciter();
      case 'info':
        showSheet('surah-options', {
          payload: {...payload, showInfo: true},
        });
        return;
      case 'remove':
        return o.handleRemoveFromPlaylist();
    }
  };

  return {title: getSurahDisplayName(payload.surah), entries, onSelect};
}

function SurahMenu({
  payload,
  ...props
}: OptionsMenuProps & {payload: SurahOptionsPayload}) {
  const model = useSurahMenuModel(payload);
  return <OptionsMenuView model={model} {...props} />;
}

/**
 * Wraps a surah row's ••• button (or, with `trigger="longPress"`, the row)
 * so tablets open the options as a native menu. Elsewhere it renders the
 * trigger unchanged and the trigger's own press opens the sheet.
 */
export function SurahOptionsMenu({
  payload,
  ...props
}: OptionsMenuProps & {payload: SurahOptionsPayload | null | undefined}) {
  const enabled = useNativeOptionsMenu(props.trigger);
  if (!enabled || !payload) return <>{props.children}</>;
  return <SurahMenu payload={payload} {...props} />;
}

/** Provides surah options to the rows below it. */
export function SurahOptionsProvider({
  build,
  children,
}: {
  build: SurahOptionsBuilder;
  children: ReactNode;
}) {
  const value = useMemo<SurahOptionsContextValue>(
    () => ({build, Menu: SurahOptionsMenu}),
    [build],
  );
  return (
    <SurahOptionsContext.Provider value={value}>
      {children}
    </SurahOptionsContext.Provider>
  );
}

/** The common case: every row shares one reciter and rewayah. */
export function SurahOptionsScope({
  reciterId,
  rewayatId,
  onAddToQueue,
  hideGoToReciter,
  children,
}: Omit<SurahOptionsPayload, 'surah'> & {children: ReactNode}) {
  const build = useMemo<SurahOptionsBuilder>(
    () => surah => ({
      surah,
      reciterId,
      rewayatId,
      onAddToQueue,
      hideGoToReciter,
    }),
    [reciterId, rewayatId, onAddToQueue, hideGoToReciter],
  );
  return <SurahOptionsProvider build={build}>{children}</SurahOptionsProvider>;
}

/** Gives one row its own payload (rows whose actions differ per track). */
export function SurahOptionsRow({
  payload,
  children,
}: {
  payload: SurahOptionsPayload | null;
  children: ReactNode;
}) {
  const build = useMemo<SurahOptionsBuilder>(() => () => payload, [payload]);
  return <SurahOptionsProvider build={build}>{children}</SurahOptionsProvider>;
}
