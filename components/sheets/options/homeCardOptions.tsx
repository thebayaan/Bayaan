// @ai-generated
import React, {useCallback} from 'react';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
import {useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useLoved} from '@/hooks/useLoved';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {getReciterById, getSurahById} from '@/services/dataService';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {
  recitationShareUrl,
  reciterShareUrl,
  shareUrl,
} from '@/utils/shareUtils';
import branding from '@/config/branding';
import {getSurahDisplayName} from '@/i18n/format';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {
  OptionsMenuView,
  useNativeOptionsMenu,
  type OptionsMenuProps,
} from './OptionsMenu';

export interface HomeCardOptionsPayload {
  reciterId: string;
  reciterName: string;
  surahId?: number;
  surahName?: string;
  rewayatId?: string;
  recentIndex?: number;
  variant: 'recent' | 'reciter';
  onContinuePlaying?: () => void;
}

/**
 * State and actions behind a Home card's options, shared by the sheet
 * (phones) and the context menu (iPad).
 */
export function useHomeCardOptions(
  payload: HomeCardOptionsPayload,
  close: () => void,
) {
  const router = useRouter();
  const {t} = useTranslation(['sheets', 'common']);
  const {isFavoriteReciter, toggleFavorite} = useFavoriteReciters();
  const {isLovedWithRewayat, toggleLoved} = useLoved();
  const {addToQueue} = usePlayerActions();

  const {
    reciterId,
    reciterName,
    surahId,
    surahName,
    rewayatId,
    recentIndex,
    variant,
  } = payload;

  const surahForName =
    surahId !== undefined ? getSurahById(surahId) : undefined;
  const displaySurahName = surahForName
    ? getSurahDisplayName(surahForName)
    : surahName;

  const isFavorite = isFavoriteReciter(reciterId);
  const isLoved =
    surahId !== undefined && rewayatId
      ? isLovedWithRewayat(reciterId, surahId, rewayatId)
      : false;

  const handleClose = close;

  const handleGoToReciter = useCallback(() => {
    handleClose();
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
        params: {id: reciterId},
      });
    }, 300);
  }, [handleClose, router, reciterId]);

  const handleToggleFavorite = useCallback(async () => {
    const reciter = await getReciterById(reciterId);
    if (reciter) toggleFavorite(reciter);
    handleClose();
  }, [reciterId, toggleFavorite, handleClose]);

  const handleToggleLoved = useCallback(() => {
    if (surahId !== undefined && rewayatId) {
      toggleLoved(reciterId, surahId, rewayatId);
    }
    handleClose();
  }, [reciterId, surahId, rewayatId, toggleLoved, handleClose]);

  const handleAddToQueue = useCallback(async () => {
    if (surahId === undefined) return;
    const reciter = await getReciterById(reciterId);
    const surah = getSurahById(surahId);
    if (!reciter || !surah) return;

    const rewayatToUseId = rewayatId || reciter.rewayat[0]?.id;
    if (!rewayatToUseId) return;

    const artwork = getReciterArtwork(reciter);
    const track = {
      id: `${reciter.id}:${surah.id}`,
      url: generateSmartAudioUrl(reciter, surah.id.toString(), rewayatToUseId),
      title: surah.name,
      artist: reciter.name,
      reciterId: reciter.id,
      artwork,
      surahId: surah.id.toString(),
      reciterName: reciter.name,
      rewayatId: rewayatToUseId,
    };

    addToQueue([track]);
    handleClose();
  }, [reciterId, surahId, rewayatId, addToQueue, handleClose]);

  const handleAddToPlaylist = useCallback(() => {
    if (surahId === undefined) return;
    const surah = getSurahById(surahId);
    if (!surah) return;
    handleClose();
    setTimeout(() => {
      showSheet('select-playlist', {
        payload: {surah, reciterId, rewayatId},
      });
    }, 300);
  }, [reciterId, surahId, rewayatId, handleClose]);

  const handleShare = useCallback(async () => {
    const reciter = await getReciterById(reciterId);
    const slug = reciter?.slug ?? String(reciterId);
    const displayName = reciter?.name ?? reciterName;
    // iOS refuses to present the native share sheet while another sheet is
    // still animating out. Mirror handleGoToReciter / handleAddToPlaylist's
    // 300ms hand-off so the action sheet closes first.
    handleClose();
    setTimeout(() => {
      if (variant === 'recent' && surahId !== undefined) {
        const url = recitationShareUrl(slug, surahId, rewayatId);
        const surahLabel =
          displaySurahName ?? t('common:labels.surahNumber', {number: surahId});
        shareUrl(
          url,
          t('homeCardOptions.shareRecitation', {
            reciter: displayName,
            surah: surahLabel,
            appName: branding.appName,
          }),
        );
        return;
      }
      shareUrl(
        reciterShareUrl(slug),
        t('homeCardOptions.shareReciter', {
          reciter: displayName,
          appName: branding.appName,
        }),
      );
    }, 300);
  }, [
    reciterId,
    reciterName,
    surahId,
    displaySurahName,
    rewayatId,
    variant,
    handleClose,
    t,
  ]);

  const handleRemoveFromRecents = useCallback(() => {
    if (recentIndex !== undefined) {
      useRecentlyPlayedStore.getState().removeTrack(recentIndex);
    }
    handleClose();
  }, [recentIndex, handleClose]);

  const handleContinuePlaying = useCallback(() => {
    handleClose();
    payload.onContinuePlaying?.();
  }, [handleClose, payload]);

  const title =
    variant === 'recent' ? (displaySurahName ?? reciterName) : reciterName;
  const subtitle = variant === 'recent' ? reciterName : undefined;

  return {
    variant,
    title,
    subtitle,
    isFavorite,
    isLoved,
    handleContinuePlaying,
    handleAddToQueue,
    handleGoToReciter,
    handleToggleFavorite,
    handleToggleLoved,
    handleAddToPlaylist,
    handleShare,
    handleRemoveFromRecents,
  };
}

// The menu closes itself when a row is chosen.
const noop = () => undefined;

function HomeCardMenu({
  payload,
  ...props
}: OptionsMenuProps & {payload: HomeCardOptionsPayload}) {
  const {t} = useTranslation(['sheets', 'common']);
  const o = useHomeCardOptions(payload, noop);
  const recent = o.variant === 'recent';
  const entries: NativeMenuEntry[] = [];
  if (recent) {
    entries.push(
      {
        id: 'continue',
        title: t('homeCardOptions.continuePlaying'),
        systemImage: 'play',
      },
      {
        id: 'queue',
        title: t('homeCardOptions.addToQueue'),
        systemImage: 'text.badge.plus',
      },
    );
  }
  entries.push(
    {
      id: 'reciter',
      title: t('homeCardOptions.goToReciter'),
      systemImage: 'person',
    },
    {
      id: 'favorite',
      title: o.isFavorite
        ? t('homeCardOptions.removeReciterFromFavorites')
        : t('homeCardOptions.addReciterToFavorites'),
      systemImage: o.isFavorite ? 'star.fill' : 'star',
    },
  );
  if (recent) {
    entries.push(
      {
        id: 'love',
        title: o.isLoved
          ? t('homeCardOptions.removeFromLoved')
          : t('homeCardOptions.addToLoved'),
        systemImage: o.isLoved ? 'heart.fill' : 'heart',
      },
      {
        id: 'collection',
        title: t('homeCardOptions.addToCollection'),
        systemImage: 'plus.circle',
      },
    );
  }
  entries.push({
    id: 'share',
    title: t('common:actions.share'),
    systemImage: 'square.and.arrow.up',
  });
  if (recent) {
    entries.push({
      id: 'destructive',
      items: [
        {
          id: 'remove',
          title: t('homeCardOptions.removeFromRecents'),
          systemImage: 'minus.circle',
          destructive: true,
        },
      ],
    });
  }

  const handlers: Record<string, () => unknown> = {
    continue: o.handleContinuePlaying,
    queue: o.handleAddToQueue,
    reciter: o.handleGoToReciter,
    favorite: o.handleToggleFavorite,
    love: o.handleToggleLoved,
    collection: o.handleAddToPlaylist,
    share: o.handleShare,
    remove: o.handleRemoveFromRecents,
  };

  return (
    <OptionsMenuView
      model={{title: o.title, entries, onSelect: id => handlers[id]?.()}}
      trigger="longPress"
      {...props}
    />
  );
}

/**
 * A Home card's long-press options as an iPad context menu (long press or
 * secondary click). Elsewhere it renders the card as is, and the card's own
 * long press opens the sheet.
 */
export function HomeCardOptionsMenu({
  payload,
  children,
  ...props
}: OptionsMenuProps & {payload: HomeCardOptionsPayload}) {
  const enabled = useNativeOptionsMenu('longPress');
  if (!enabled) return <>{children}</>;
  return (
    <HomeCardMenu payload={payload} {...props}>
      {children}
    </HomeCardMenu>
  );
}
