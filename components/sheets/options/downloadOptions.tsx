// @ai-generated
import React from 'react';
import {confirmDestructive} from '@/utils/confirmDestructive'; // @ai
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
import {useTranslation} from 'react-i18next';
import {useLoved} from '@/hooks/useLoved';
import {getSurahDisplayName} from '@/i18n/format';
import type {Surah} from '@/data/surahData';
import type {DownloadedSurah} from '@/services/player/store/downloadStore';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {OptionsMenuView, type OptionsMenuProps} from './OptionsMenu';

export interface DownloadOptionsPayload {
  download: DownloadedSurah;
  surah: Surah;
  reciterId: string;
  rewayatId: string;
  onPlay: () => void;
  onAddToQueue: () => void;
  onRemoveDownload: () => void;
  /** Open straight on "Learn about this surah" (from a native menu). */
  showInfo?: boolean;
}

/**
 * A downloaded surah's options as a native menu, laid over its ••• button
 * on tablets. Callers render it only where `useNativeOptionsMenu()` is true.
 */
export function DownloadOptionsMenu({
  payload,
  ...props
}: OptionsMenuProps & {payload: DownloadOptionsPayload}) {
  const {t} = useTranslation(['sheets', 'common', 'player']);
  const {isLovedWithRewayat, toggleLoved} = useLoved();
  const {surah, reciterId, rewayatId} = payload;
  const surahId = String(surah.id);
  const isLoved = isLovedWithRewayat(reciterId, surahId, rewayatId);

  const entries: NativeMenuEntry[] = [
    {id: 'play', title: t('options.playNow'), systemImage: 'play'},
    {
      id: 'love',
      title: isLoved ? t('options.removeFromLoved') : t('options.addToLoved'),
      systemImage: isLoved ? 'heart.fill' : 'heart',
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
    {
      id: 'info',
      title: t('options.learnAboutSurah'),
      systemImage: 'info.circle',
    },
    {
      id: 'destructive',
      items: [
        {
          id: 'remove',
          title: t('downloadOptions.removeTitle'),
          systemImage: 'trash',
          destructive: true,
        },
      ],
    },
  ];

  const onSelect = (id: string) => {
    switch (id) {
      case 'play':
        return payload.onPlay();
      case 'love':
        return toggleLoved(reciterId, surahId, rewayatId);
      case 'queue':
        return payload.onAddToQueue();
      case 'collection':
        showSheet('select-playlist', {
          payload: {surah, reciterId, rewayatId},
        });
        return;
      case 'info':
        showSheet('download-options', {
          payload: {...payload, showInfo: true},
        });
        return;
      case 'remove':
        confirmDestructive({
          title: t('downloadOptions.removeTitle'),
          message: t('downloadOptions.removeMessage'),
          confirmText: t('common:actions.remove'),
          cancelText: t('common:actions.cancel'),
          onConfirm: payload.onRemoveDownload,
        });
        return;
    }
  };

  return (
    <OptionsMenuView
      model={{title: getSurahDisplayName(surah), entries, onSelect}}
      layout="overlay"
      accessibilityLabel={t('player:a11y.moreOptions')}
      {...props}
    />
  );
}
