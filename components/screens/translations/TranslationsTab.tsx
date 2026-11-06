// @ai-generated
import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {Alert} from 'react-native';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {SearchInput} from '@/components/SearchInput';
import {confirmDestructive} from '@/utils/confirmDestructive';
import {lightHaptics} from '@/utils/haptics';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';
import {
  buildTranslationPicker,
  type PickerRow,
} from '@/store/translationPicker';
import {translationDownloadFailure} from '@/services/content/contentNotices';
import {contentLanguageName} from '@/services/content/contentLanguage';
import {DEFAULT_TRANSLATION_ID} from '@/services/translation/translationRemap';
import {formatBytes} from '@/services/storageService';
import {
  getTranslationName,
  isBundledTranslation,
  registerRemoteTranslationName,
} from '@/utils/translationLookup';
import {BUNDLED_TRANSLATIONS} from '@/types/translation';
import {currentLanguage} from '@/i18n/language';
import {getEnglishLanguageDisplayName} from '@/i18n/languageNames';
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
import {usePickerStyles} from './pickerStyles';

function rowFields(row: PickerRow): RowFields {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    isReady: row.isBundled || row.isDownloaded,
    isDeletable: row.isDownloaded && !row.isBundled,
  };
}

// The Translations tab: the active edition, then installed editions, then
// the catalog grouped by language.
export function TranslationsTab() {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const styles = usePickerStyles();

  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const setSelectedTranslationId = useMushafSettingsStore(
    s => s.setSelectedTranslationId,
  );
  const downloadedMeta = useTranslationStore(s => s.downloadedMeta);
  const offeredTranslations = useTranslationStore(s => s.offeredTranslations);
  const loadOfferedTranslations = useTranslationStore(
    s => s.loadOfferedTranslations,
  );
  const downloadingId = useTranslationStore(s => s.downloadingId);
  const downloadProgress = useTranslationStore(s => s.downloadProgress);
  const downloadTranslation = useTranslationStore(s => s.downloadTranslation);
  const deleteTranslation = useTranslationStore(s => s.deleteTranslation);
  const loadDownloadedMeta = useTranslationStore(s => s.loadDownloadedMeta);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadDownloadedMeta();
    loadOfferedTranslations();
  }, [loadDownloadedMeta, loadOfferedTranslations]);

  useEffect(() => {
    for (const meta of downloadedMeta) {
      registerRemoteTranslationName(meta.identifier, meta.englishName);
    }
    for (const edition of offeredTranslations ?? []) {
      registerRemoteTranslationName(edition.id, edition.name);
    }
  }, [downloadedMeta, offeredTranslations]);

  const handleSelect = useCallback(
    (id: string) => {
      lightHaptics();
      setSelectedTranslationId(id);
    },
    [setSelectedTranslationId],
  );

  const handleDownload = useCallback(
    async (editionId: string) => {
      // Fire before the guard so a blocked tap still buzzes — acknowledge the tap.
      lightHaptics();
      // Guard on this download type's own in-flight state. translations and
      // tafaseer write separate DBs (no shared write path) so they can run
      // concurrently; the store already no-ops a double-tap — this Alert just
      // makes that refusal visible to the user.
      if (downloadingId) {
        showDownloadInProgressAlert();
        return;
      }
      try {
        await downloadTranslation(editionId);
      } catch (error) {
        const {title, message} = translationDownloadFailure(error);
        Alert.alert(title, message);
      }
    },
    [downloadTranslation, downloadingId],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const meta = downloadedMeta.find(m => m.identifier === id);
      if (!meta) return;
      confirmDestructive({
        title: t('translations.deleteTranslationTitle'),
        message: t('translations.deleteMessage', {name: meta.englishName}),
        confirmText: t('common:actions.delete'),
        cancelText: t('common:actions.cancel'),
        onConfirm: async () => {
          if (selectedTranslationId === meta.identifier) {
            setSelectedTranslationId(DEFAULT_TRANSLATION_ID);
          }
          await deleteTranslation(meta.identifier);
        },
      });
    },
    [
      deleteTranslation,
      downloadedMeta,
      selectedTranslationId,
      setSelectedTranslationId,
      t,
    ],
  );

  // Installed editions first, then the catalog grouped by language; before
  // any catalog is known, a short row says how to see more.
  const data = useMemo((): FlatItem[] => {
    const picker = buildTranslationPicker({
      downloaded: downloadedMeta,
      offered: offeredTranslations,
      selectedId: selectedTranslationId,
      query,
      uiLanguage: currentLanguage,
      formatSize: formatBytes,
    });
    const items: FlatItem[] = [];
    if (picker.installed.length > 0) {
      items.push({type: 'meta-header', title: t('translations.available')});
      items.push(...cardGroup(picker.installed.map(rowFields)));
    }
    for (const group of picker.groups) {
      items.push({
        type: 'lang-header',
        title: group.title,
        count: group.rows.length,
      });
      items.push(...cardGroup(group.rows.map(rowFields)));
    }
    if (picker.needsCatalog) items.push({type: 'connect'});
    return items;
  }, [selectedTranslationId, downloadedMeta, offeredTranslations, query, t]);

  const header = useMemo(() => {
    const activeLanguage = isBundledTranslation(selectedTranslationId)
      ? BUNDLED_TRANSLATIONS[selectedTranslationId].language
      : (offeredTranslations?.find(e => e.id === selectedTranslationId)
          ?.language ??
        contentLanguageName(
          downloadedMeta.find(m => m.identifier === selectedTranslationId)
            ?.language,
        ) ??
        '');
    return (
      <>
        <ActiveCard
          label={t('translations.activeTranslation')}
          name={getTranslationName(selectedTranslationId)}
          language={getEnglishLanguageDisplayName(activeLanguage)}
        />
        <SearchInput
          placeholder={t('translations.searchTranslations')}
          value={query}
          onChangeText={setQuery}
          showCancelButton={false}
          iconColor={theme.colors.text}
          iconOpacity={0.25}
          placeholderTextColor={Color(theme.colors.text).alpha(0.35).toString()}
          textColor={theme.colors.text}
          backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
          borderColor={Color(theme.colors.text).alpha(0.06).toString()}
          autoCorrect={false}
          autoCapitalize="none"
          containerStyle={styles.searchContainer}
        />
      </>
    );
  }, [
    selectedTranslationId,
    downloadedMeta,
    offeredTranslations,
    query,
    styles,
    theme.colors.text,
    t,
  ]);

  const renderRow = useCallback(
    (item: RowItem) => (
      <CatalogRow
        item={item}
        isActive={item.id === selectedTranslationId}
        isDownloading={item.id === downloadingId}
        progress={downloadProgress}
        onSelect={handleSelect}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    ),
    [
      selectedTranslationId,
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
      keyPrefix="trans"
      header={header}
      emptyText={t('translations.noTranslations')}
      renderRow={renderRow}
    />
  );
}
