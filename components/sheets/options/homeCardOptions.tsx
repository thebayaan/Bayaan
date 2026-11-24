// @ai-generated
import React, {useCallback} from 'react';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
import {useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useLoved} from '@/hooks/useLoved';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {findRecentIndex} from '@/components/cards/recentCardEntry'; // @ai
import {useUploadsStore} from '@/store/uploadsStore'; // @ai
import {createUserUploadTrack} from '@/utils/track'; // @ai
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
  /** Set on an upload's card: the upload's id. @ai */
  userRecitationId?: string; // @ai
  variant: 'recent' | 'reciter';
  onContinuePlaying?: () => void;
  // @ai-start
  /** Browse › All reciters: opens the profile in its own tab's stack. */
  onOpen?: () => void;
  /** Browse › All reciters: plays or shuffles everything they recorded. */
  onPlayAll?: () => void;
  onShuffleAll?: () => void;
  // @ai-end
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
    userRecitationId, // @ai
    variant,
  } = payload;

  const surahForName =
    surahId !== undefined ? getSurahById(surahId) : undefined;
  const displaySurahName = surahForName
    ? getSurahDisplayName(surahForName)
    : surahName;

  // @ai-start
  // An upload's card carries the reciter and surah it was played under, or
  // the '__uploads__' placeholder and surah 0 when it had no tags. The rows
  // act on the upload as it is tagged now, the way its own options do, and
  // never on the catalogue recording of the same reciter and surah.
  const isUpload = userRecitationId !== undefined;
  const upload = useUploadsStore(state =>
    userRecitationId !== undefined
      ? state.recitations.find(r => r.id === userRecitationId)
      : undefined,
  );
  const actionReciterId = isUpload ? upload?.reciterId ?? undefined : reciterId;
  const actionSurahId = isUpload ? upload?.surahNumber ?? undefined : surahId;
  const canAddToQueue = !isUpload || upload !== undefined;
  const canUseReciter = actionReciterId !== undefined;
  const canUseRecitation =
    !isUpload || (actionReciterId !== undefined && actionSurahId !== undefined);
  // An upload lives only on this device, so it has no link to share.
  const canShare = !isUpload;

  const isFavorite =
    actionReciterId !== undefined && isFavoriteReciter(actionReciterId);
  let isLoved = false;
  if (isUpload) {
    isLoved =
      actionReciterId !== undefined &&
      actionSurahId !== undefined &&
      isLovedWithRewayat(actionReciterId, actionSurahId, '', userRecitationId);
  } else if (surahId !== undefined && rewayatId) {
    isLoved = isLovedWithRewayat(reciterId, surahId, rewayatId);
  }
  // @ai-end

  const handleClose = close;

  const onOpen = payload.onOpen; // @ai
  const handleGoToReciter = useCallback(() => {
    handleClose();
    if (actionReciterId === undefined) return; // @ai
    if (onOpen) {
      setTimeout(onOpen, 300); // @ai
      return;
    }
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
        params: {id: actionReciterId}, // @ai
      });
    }, 300);
  }, [handleClose, router, actionReciterId, onOpen]); // @ai

  const handleToggleFavorite = useCallback(async () => {
    // @ai-start
    const reciter =
      actionReciterId !== undefined
        ? await getReciterById(actionReciterId)
        : undefined;
    // @ai-end
    if (reciter) toggleFavorite(reciter);
    handleClose();
  }, [actionReciterId, toggleFavorite, handleClose]); // @ai

  const handleToggleLoved = useCallback(() => {
    // @ai-start
    if (isUpload) {
      if (actionReciterId !== undefined && actionSurahId !== undefined) {
        toggleLoved(actionReciterId, actionSurahId, '', userRecitationId);
      }
    } else if (surahId !== undefined && rewayatId) {
      toggleLoved(reciterId, surahId, rewayatId);
    }
    handleClose();
  }, [
    isUpload,
    actionReciterId,
    actionSurahId,
    userRecitationId,
    reciterId,
    surahId,
    rewayatId,
    toggleLoved,
    handleClose,
  ]);
  // @ai-end

  const handleAddToQueue = useCallback(async () => {
    // @ai-start
    // Queue the upload's own file. Its card's reciter and surah would have
    // queued the catalogue recording, or nothing at all when untagged.
    if (isUpload) {
      if (upload) addToQueue([createUserUploadTrack(upload)]);
      handleClose();
      return;
    }
    // @ai-end
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
  }, [
    isUpload, // @ai
    upload, // @ai
    reciterId,
    surahId,
    rewayatId,
    addToQueue,
    handleClose,
  ]);

  const handleAddToPlaylist = useCallback(() => {
    // @ai-start
    if (actionReciterId === undefined || actionSurahId === undefined) {
      handleClose();
      return;
    }
    const surah = getSurahById(actionSurahId);
    if (!surah) {
      handleClose();
      return;
    }
    handleClose();
    setTimeout(() => {
      showSheet('select-playlist', {
        payload: {
          surah,
          reciterId: actionReciterId,
          rewayatId,
          userRecitationId,
        },
      });
    }, 300);
  }, [
    actionReciterId,
    actionSurahId,
    rewayatId,
    userRecitationId,
    handleClose,
  ]);
  // @ai-end

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
    // @ai-start
    // Found now, not when the options opened: a card arriving at the front
    // in the meantime shifts every position, and the position the card had
    // when it was pressed then removed a different card.
    const index = findRecentIndex({
      reciterId,
      surahId,
      rewayatId,
      userRecitationId,
    });
    if (index !== -1) {
      useRecentlyPlayedStore.getState().removeTrack(index);
    }
    // @ai-end
    handleClose();
  }, [reciterId, surahId, rewayatId, userRecitationId, handleClose]); // @ai

  const handleContinuePlaying = useCallback(() => {
    handleClose();
    payload.onContinuePlaying?.();
  }, [handleClose, payload]);

  const title =
    variant === 'recent' ? displaySurahName ?? reciterName : reciterName;
  const subtitle = variant === 'recent' ? reciterName : undefined;

  return {
    variant,
    title,
    subtitle,
    isFavorite,
    isLoved,
    // @ai-start
    canAddToQueue,
    canUseReciter,
    canUseRecitation,
    canShare,
    // @ai-end
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
  // @ai-start
  if (recent) {
    entries.push({
      id: 'continue',
      title: t('homeCardOptions.continuePlaying'),
      systemImage: 'play',
    });
  }
  if (recent && o.canAddToQueue) {
    entries.push({
      id: 'queue',
      title: t('homeCardOptions.addToQueue'),
      systemImage: 'text.badge.plus',
    });
  }
  if (o.canUseReciter) {
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
  }
  if (recent && o.canUseRecitation) {
    // @ai-end
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
  // @ai-start
  if (o.canShare) {
    entries.push({
      id: 'share',
      title: t('common:actions.share'),
      systemImage: 'square.and.arrow.up',
    });
  }
  // @ai-end
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
