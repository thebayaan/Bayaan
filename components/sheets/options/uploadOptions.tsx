// @ai-generated
import React from 'react';
import {confirmDestructive} from '@/utils/confirmDestructive'; // @ai
import {SheetManager} from 'react-native-actions-sheet';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
import {useTranslation} from 'react-i18next';
import {useLoved} from '@/hooks/useLoved';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {useUploadsStore} from '@/store/uploadsStore';
import {getSurahById} from '@/services/dataService';
import {getSurahDisplayName} from '@/i18n/format';
import type {UploadedRecitation} from '@/types/uploads';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {OptionsMenuView, type OptionsMenuProps} from './OptionsMenu';

export interface UploadOptionsPayload {
  recitation: UploadedRecitation;
  reciterId: string;
  onPlay: () => void;
  onAddToQueue: () => void;
  /** Open straight on "Learn about this surah" (from a native menu). */
  showInfo?: boolean;
}

/** The title an upload is listed under. */
export function getUploadDisplayTitle(item: UploadedRecitation): string {
  if (item.type === 'surah' && item.surahNumber) {
    const surah = getSurahById(item.surahNumber);
    if (surah) return getSurahDisplayName(surah);
  }
  if (item.type === 'other' && item.title) {
    return item.title;
  }
  return item.originalFilename.replace(/\.[^/.]+$/, '');
}

/**
 * An upload's options as a native menu, laid over its ••• button on
 * tablets. Callers render it only where `useNativeOptionsMenu()` is true.
 */
export function UploadOptionsMenu({
  payload,
  ...props
}: OptionsMenuProps & {payload: UploadOptionsPayload}) {
  const {t} = useTranslation(['sheets', 'common', 'player']);
  const {isLovedWithRewayat, toggleLoved} = useLoved();
  const {navigateToReciterProfile} = useReciterNavigation();
  const deleteRecitation = useUploadsStore(state => state.deleteRecitation);
  const {recitation, reciterId} = payload;
  const surah = recitation.surahNumber
    ? getSurahById(recitation.surahNumber)
    : null;
  const surahId = surah ? String(surah.id) : '';
  const hasReciter = !!reciterId;
  const isLoved =
    !!surah && hasReciter && isLovedWithRewayat(reciterId, surahId, '');

  const entries: NativeMenuEntry[] = [
    {id: 'play', title: t('options.playNow'), systemImage: 'play'},
    {
      id: 'organize',
      title: t('options.editDetails'),
      systemImage: 'slider.horizontal.3',
    },
    {
      id: 'queue',
      title: t('options.addToQueue'),
      systemImage: 'text.badge.plus',
    },
  ];
  if (surah && hasReciter) {
    entries.push(
      {
        id: 'love',
        title: isLoved ? t('options.removeFromLoved') : t('options.addToLoved'),
        systemImage: isLoved ? 'heart.fill' : 'heart',
      },
      {
        id: 'collection',
        title: t('options.addToCollection'),
        systemImage: 'plus.circle',
      },
    );
  }
  if (hasReciter) {
    entries.push({
      id: 'reciter',
      title: t('options.goToReciter'),
      systemImage: 'person',
    });
  }
  if (surah) {
    entries.push({
      id: 'info',
      title: t('options.learnAboutSurah'),
      systemImage: 'info.circle',
    });
  }
  entries.push({
    id: 'destructive',
    items: [
      {
        id: 'delete',
        title: t('common:actions.delete'),
        systemImage: 'trash',
        destructive: true,
      },
    ],
  });

  const onSelect = (id: string) => {
    switch (id) {
      case 'play':
        return payload.onPlay();
      case 'organize':
        SheetManager.show('organize-recitation', {
          payload: {recitation, prefillReciterId: reciterId},
        });
        return;
      case 'queue':
        return payload.onAddToQueue();
      case 'love':
        return toggleLoved(reciterId, surahId, '', recitation.id);
      case 'collection':
        if (!surah) return;
        showSheet('select-playlist', {
          payload: {
            surah,
            reciterId,
            rewayatId: undefined,
            userRecitationId: recitation.id,
          },
        });
        return;
      case 'reciter':
        return navigateToReciterProfile(reciterId);
      case 'info':
        showSheet('upload-options', {
          payload: {...payload, showInfo: true},
        });
        return;
      case 'delete':
        confirmDestructive({
          title: t('uploads.deleteTitle'),
          message: t('uploads.deleteMessage', {
            title: getUploadDisplayTitle(recitation),
          }),
          confirmText: t('common:actions.delete'),
          cancelText: t('common:actions.cancel'),
          onConfirm: () => deleteRecitation(recitation.id),
        });
        return;
    }
  };

  return (
    <OptionsMenuView
      model={{title: getUploadDisplayTitle(recitation), entries, onSelect}}
      layout="overlay"
      accessibilityLabel={t('player:a11y.moreOptions')}
      {...props}
    />
  );
}
