// @ai-generated
import React from 'react';
import {confirmDestructive} from '@/utils/confirmDestructive'; // @ai
import {useTranslation} from 'react-i18next';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {OptionsMenuView, type OptionsMenuProps} from './OptionsMenu';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai

export interface PlaylistOptionsPayload {
  playlistId: string;
  playlistName: string;
  playlistColor?: string;
  onDelete: () => void;
  onEdit?: () => void;
  /**
   * Start downloading as soon as the sheet opens (from a native menu), so
   * the sheet shows the progress.
   */
  startDownload?: boolean;
}

/**
 * A collection's options as a native menu on tablets. Downloading opens the
 * sheet, which shows the progress. Callers render it only where
 * `useNativeOptionsMenu()` is true.
 */
export function PlaylistOptionsMenu({
  payload,
  ...props
}: OptionsMenuProps & {payload: PlaylistOptionsPayload}) {
  const {t} = useTranslation(['sheets', 'common', 'player']);

  const entries: NativeMenuEntry[] = [];
  if (payload.onEdit) {
    entries.push({
      id: 'edit',
      title: t('playlistContext.edit'),
      systemImage: 'pencil',
    });
  }
  entries.push(
    {
      id: 'download',
      title: t('playlistContext.download'),
      systemImage: 'arrow.down.circle',
    },
    {
      id: 'destructive',
      items: [
        {
          id: 'delete',
          title: t('playlistContext.delete'),
          systemImage: 'minus.circle',
          destructive: true,
        },
      ],
    },
  );

  const onSelect = (id: string) => {
    switch (id) {
      case 'edit':
        return payload.onEdit?.();
      case 'download':
        showSheet('playlist-context', {
          payload: {...payload, startDownload: true},
        });
        return;
      case 'delete':
        confirmDestructive({
          title: t('playlistContext.deleteTitle'),
          message: t('playlistContext.deleteMessage', {
            name: payload.playlistName,
          }),
          confirmText: t('common:actions.delete'),
          cancelText: t('common:actions.cancel'),
          onConfirm: payload.onDelete,
        });
        return;
    }
  };

  return (
    <OptionsMenuView
      model={{title: payload.playlistName, entries, onSelect}}
      layout="overlay"
      accessibilityLabel={t('player:a11y.moreOptions')}
      {...props}
    />
  );
}
