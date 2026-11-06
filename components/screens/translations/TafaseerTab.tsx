// @ai-generated
import React, {useCallback, useMemo, useEffect} from 'react';
import {Alert} from 'react-native';
import {useTranslation} from 'react-i18next';
import {confirmDestructive} from '@/utils/confirmDestructive';
import {lightHaptics} from '@/utils/haptics';
import {browsableTafaseer, useTafseerStore} from '@/store/tafseerStore';
import {tafseerDownloadFailure} from '@/services/content/contentNotices';
import {AVAILABLE_TAFASEER} from '@/data/availableTafaseer';
import {currentLanguage} from '@/i18n/language';
import {SOURCE_LANGUAGE} from '@/i18n/languages';
import {
  compareLanguageGroups,
  getEnglishLanguageDisplayName,
  isPreferredLanguage,
} from '@/i18n/languageNames';
import {compareTafaseer, getTafseerDisplayName} from '@/i18n/tafseer';
import {
  ActiveCard,
  CatalogRow,
  PickerList,
  cardGroup,
  showDownloadInProgressAlert,
  type FlatItem,
  type RowFields,
  type RowItem,
} from './PickerList';

interface TafseerEntry {
  identifier: string;
  name: string;
  englishName: string;
  language: string;
  isDownloaded: boolean;
}

// Outside English, the language under the title; in English, the Arabic
// name when it differs.
function rowFields(entry: TafseerEntry): RowFields {
  const subtitle =
    currentLanguage !== SOURCE_LANGUAGE
      ? getEnglishLanguageDisplayName(entry.language)
      : entry.name !== entry.englishName
        ? entry.name
        : null;
  return {
    id: entry.identifier,
    title: getTafseerDisplayName(entry),
    subtitle,
    isReady: entry.isDownloaded,
    isDeletable: entry.isDownloaded,
  };
}

// The Tafaseer tab: the active tafseer, the reader's own language (outside
// English), downloaded tafaseer, then the catalog grouped by language.
export function TafaseerTab() {
  const {t} = useTranslation(['home', 'common']);

  const downloaded = useTafseerStore(s => s.downloadedMeta);
  const downloadingId = useTafseerStore(s => s.downloadingId);
  const downloadProgress = useTafseerStore(s => s.downloadProgress);
  const selectedTafseerId = useTafseerStore(s => s.selectedTafseerId);
  const downloadTafseer = useTafseerStore(s => s.downloadTafseer);
  const deleteTafseer = useTafseerStore(s => s.deleteTafseer);
  const setSelectedTafseerId = useTafseerStore(s => s.setSelectedTafseerId);
  const loadDownloadedMeta = useTafseerStore(s => s.loadDownloadedMeta);
  const offeredTafsirIds = useTafseerStore(s => s.offeredTafsirIds);
  const loadOfferedTafsirs = useTafseerStore(s => s.loadOfferedTafsirs);

  useEffect(() => {
    loadDownloadedMeta();
    loadOfferedTafsirs();
  }, [loadDownloadedMeta, loadOfferedTafsirs]);

  const downloadedIds = useMemo(
    () => new Set(downloaded.map(m => m.identifier)),
    [downloaded],
  );

  const handleSelect = useCallback(
    (id: string) => {
      lightHaptics();
      setSelectedTafseerId(id);
    },
    [setSelectedTafseerId],
  );

  const handleDownload = useCallback(
    async (editionId: string) => {
      // Fire before the guard so a blocked tap still buzzes — acknowledge the tap.
      lightHaptics();
      // Own-state guard (see TranslationsTab) — tafaseer.db is separate from
      // translations.db, so a running translation download must not block this.
      if (downloadingId) {
        showDownloadInProgressAlert();
        return;
      }
      try {
        await downloadTafseer(editionId);
      } catch (error) {
        const {title, message} = tafseerDownloadFailure(error);
        Alert.alert(title, message);
      }
    },
    [downloadTafseer, downloadingId],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const meta = downloaded.find(m => m.identifier === id);
      if (!meta) return;
      confirmDestructive({
        title: t('translations.deleteTafseerTitle'),
        message: t('translations.deleteMessage', {
          name: getTafseerDisplayName(meta),
        }),
        confirmText: t('common:actions.delete'),
        cancelText: t('common:actions.cancel'),
        onConfirm: async () => {
          await deleteTafseer(meta.identifier);
        },
      });
    },
    [deleteTafseer, downloaded, t],
  );

  const data = useMemo((): FlatItem[] => {
    const entries: TafseerEntry[] = [
      ...downloaded.map(meta => ({...meta, isDownloaded: true})),
      ...browsableTafaseer(
        AVAILABLE_TAFASEER,
        downloadedIds,
        offeredTafsirIds,
      ).map(edition => ({...edition, isDownloaded: false})),
    ];
    const items: FlatItem[] = [];

    // Put matching-language editions before other downloads for non-English
    // readers. The explicitly selected edition remains in the active card.
    const preferred =
      currentLanguage !== SOURCE_LANGUAGE
        ? entries
            .filter(
              entry =>
                entry.identifier !== selectedTafseerId &&
                isPreferredLanguage(entry.language),
            )
            .sort(compareTafaseer)
        : [];
    const preferredIds = new Set(preferred.map(entry => entry.identifier));
    if (preferred.length > 0) {
      items.push({
        type: 'lang-header',
        title: getEnglishLanguageDisplayName(currentLanguage),
        count: preferred.length,
      });
      items.push(...cardGroup(preferred.map(rowFields)));
    }

    // Downloaded tafaseer, the active one excluded.
    const available = entries
      .filter(
        entry =>
          entry.isDownloaded &&
          entry.identifier !== selectedTafseerId &&
          !preferredIds.has(entry.identifier),
      )
      .sort(compareTafaseer);
    if (available.length > 0) {
      items.push({type: 'meta-header', title: t('translations.available')});
      items.push(...cardGroup(available.map(rowFields)));
    }

    // Language groups of the tafaseer still to download.
    const byLanguage = new Map<string, TafseerEntry[]>();
    for (const entry of entries) {
      if (entry.isDownloaded || preferredIds.has(entry.identifier)) continue;
      const group = byLanguage.get(entry.language) ?? [];
      group.push(entry);
      byLanguage.set(entry.language, group);
    }
    const languages = [...byLanguage.entries()].sort(([a], [b]) =>
      compareLanguageGroups(a, b),
    );
    for (const [language, group] of languages) {
      items.push({
        type: 'lang-header',
        title: getEnglishLanguageDisplayName(language),
        count: group.length,
      });
      items.push(...cardGroup(group.sort(compareTafaseer).map(rowFields)));
    }
    return items;
  }, [selectedTafseerId, downloaded, downloadedIds, offeredTafsirIds, t]);

  const header = useMemo(() => {
    const active = downloaded.find(m => m.identifier === selectedTafseerId);
    if (!selectedTafseerId || !active) return null;
    return (
      <ActiveCard
        label={t('translations.activeTafseer')}
        name={getTafseerDisplayName(active)}
        language={getEnglishLanguageDisplayName(active.language)}
      />
    );
  }, [selectedTafseerId, downloaded, t]);

  const renderRow = useCallback(
    (item: RowItem) => (
      <CatalogRow
        item={item}
        isActive={item.id === selectedTafseerId}
        isDownloading={item.id === downloadingId}
        // Engine downloads report no byte progress: spinner only.
        progress={downloadProgress > 0 ? downloadProgress : null}
        onSelect={handleSelect}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    ),
    [
      selectedTafseerId,
      downloadingId,
      downloadProgress,
      handleSelect,
      handleDownload,
      handleDelete,
    ],
  );

  return (
    <PickerList
      data={data}
      keyPrefix="tafseer"
      header={header}
      emptyText={t('translations.noTafaseer')}
      renderRow={renderRow}
    />
  );
}
