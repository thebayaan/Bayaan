import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useNavigation} from 'expo-router';
import TabSelector from '@/components/TabSelector';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';
import {useTafseerStore} from '@/store/tafseerStore';
import {
  getTranslationName,
  isBundledTranslation,
  registerRemoteTranslationName,
} from '@/utils/translationLookup';
import {
  BUNDLED_TRANSLATIONS,
  type BundledTranslationId,
  type DownloadedTranslationMeta,
} from '@/types/translation';
import type {DownloadedTafseerMeta} from '@/types/tafseer';
import {lightHaptics} from '@/utils/haptics';
import {useBottomInset} from '@/hooks/useBottomInset';
import {AVAILABLE_TRANSLATIONS} from '@/data/availableTranslations';
import {AVAILABLE_TAFASEER} from '@/data/availableTafaseer';
// @ai-start
import {latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import i18n from '@/i18n';
import {localizeDigits} from '@/i18n/format';
import {currentLanguage, currentLanguageConfig} from '@/i18n/language';
import {SOURCE_LANGUAGE, getIntlLocale} from '@/i18n/languages';
import {
  compareTafaseer,
  getTafseerDisplayName,
  getTranslationDisplayName,
  isPreferredTafseerLanguage,
} from '@/i18n/tafseer';
// @ai-end

type ActiveTab = 'Translations' | 'Tafaseer';
const TAB_OPTIONS: ActiveTab[] = ['Translations', 'Tafaseer'];

// @ai-start
const LANGUAGE_CODES = [
  'en',
  'ar',
  'fr',
  'de',
  'es',
  'pt',
  'ru',
  'tr',
  'ur',
  'id',
  'ms',
  'bn',
  'hi',
  'fa',
  'zh',
  'ja',
  'ko',
  'it',
  'nl',
  'pl',
  'sv',
  'th',
  'vi',
  'ha',
  'so',
  'sw',
  'am',
  'az',
  'bs',
  'cs',
  'dv',
  'ku',
  'ml',
  'no',
  'ro',
  'sq',
  'ta',
  'tt',
  'ug',
  'uz',
] as const;
// @ai-end
const showDownloadInProgressAlert = () =>
  Alert.alert(
    i18n.t('home:translations.downloadInProgress'),
    i18n.t('home:translations.waitForDownload'),
  );

// @ai-start
type LanguageCode = (typeof LANGUAGE_CODES)[number];
// @ai-end

// @ai-start
const ENGLISH_LANGUAGE_NAMES: Record<string, LanguageCode> = {
  English: 'en',
  Arabic: 'ar',
  French: 'fr',
  German: 'de',
  Spanish: 'es',
  Portuguese: 'pt',
  Russian: 'ru',
  Turkish: 'tr',
  Urdu: 'ur',
  Indonesian: 'id',
  Malay: 'ms',
  Bengali: 'bn',
  Hindi: 'hi',
  Persian: 'fa',
  Chinese: 'zh',
  Japanese: 'ja',
  Korean: 'ko',
  Italian: 'it',
  Dutch: 'nl',
  Polish: 'pl',
  Swedish: 'sv',
  Thai: 'th',
  Vietnamese: 'vi',
  Hausa: 'ha',
  Somali: 'so',
  Swahili: 'sw',
  Amharic: 'am',
  Azerbaijani: 'az',
  Bosnian: 'bs',
  Czech: 'cs',
  Dhivehi: 'dv',
  Kurdish: 'ku',
  Malayalam: 'ml',
  Norwegian: 'no',
  Romanian: 'ro',
  Albanian: 'sq',
  Tamil: 'ta',
  Tatar: 'tt',
  Uyghur: 'ug',
  Uzbek: 'uz',
};
// @ai-end

// @ai-start
function isLanguageCode(code: string): code is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(code);
}
// @ai-end

// @ai-start
function getLanguageDisplayName(code: string): string {
  if (isLanguageCode(code)) {
    return i18n.t(`home:languages.${code}`);
  }
  return code.charAt(0).toUpperCase() + code.slice(1);
}
// @ai-end

/** Tafseer editions store the English language name rather than a code. */
// @ai-start
function getTafseerLanguageDisplayName(name: string): string {
  const code = ENGLISH_LANGUAGE_NAMES[name];
  return code ? i18n.t(`home:languages.${code}`) : name;
}
// @ai-end

function normalizeTafseerLanguage(lang: string): string {
  return lang;
}

const bundledIds = Object.keys(BUNDLED_TRANSLATIONS) as BundledTranslationId[];

// Flattened item types for FlashList
interface MetaHeaderItem {
  type: 'meta-header';
  title: string;
}

interface LangHeaderItem {
  type: 'lang-header';
  title: string;
  count: number;
}

interface RowItem {
  type: 'row';
  id: string;
  name: string;
  englishName: string;
  language: string;
  isBundled: boolean;
  isDownloaded: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

type FlatItem = MetaHeaderItem | LangHeaderItem | RowItem;

// @ai-start
export default function TranslationsContent() {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = USE_GLASS ? rawHeaderHeight : 0;
  const bottomInset = useBottomInset();

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    currentLanguageConfig.understandsArabic ? 'Tafaseer' : 'Translations',
  );

  // --- Translation state ---
  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const setSelectedTranslationId = useMushafSettingsStore(
    s => s.setSelectedTranslationId,
  );

  const downloadedMeta = useTranslationStore(s => s.downloadedMeta);
  const downloadingId = useTranslationStore(s => s.downloadingId);
  const downloadProgress = useTranslationStore(s => s.downloadProgress);
  const downloadTranslation = useTranslationStore(s => s.downloadTranslation);
  const deleteTranslation = useTranslationStore(s => s.deleteTranslation);
  const loadDownloadedMeta = useTranslationStore(s => s.loadDownloadedMeta);

  // --- Tafseer state ---
  const tafseerDownloaded = useTafseerStore(s => s.downloadedMeta);
  const tafseerDownloadingId = useTafseerStore(s => s.downloadingId);
  const tafseerDownloadProgress = useTafseerStore(s => s.downloadProgress);
  const selectedTafseerId = useTafseerStore(s => s.selectedTafseerId);
  const downloadTafseer = useTafseerStore(s => s.downloadTafseer);
  const deleteTafseer = useTafseerStore(s => s.deleteTafseer);
  const setSelectedTafseerId = useTafseerStore(s => s.setSelectedTafseerId);
  const loadTafseerMeta = useTafseerStore(s => s.loadDownloadedMeta);

  useEffect(() => {
    loadDownloadedMeta();
    loadTafseerMeta();
  }, [loadDownloadedMeta, loadTafseerMeta]);

  useEffect(() => {
    for (const meta of downloadedMeta) {
      registerRemoteTranslationName(meta.identifier, meta.englishName);
    }
    for (const edition of AVAILABLE_TRANSLATIONS) {
      registerRemoteTranslationName(edition.identifier, edition.englishName);
    }
  }, [downloadedMeta]);

  const downloadedIds = useMemo(
    () => new Set(downloadedMeta.map(m => m.identifier)),
    [downloadedMeta],
  );

  const tafseerDownloadedIds = useMemo(
    () => new Set(tafseerDownloaded.map(m => m.identifier)),
    [tafseerDownloaded],
  );

  // --- Translation handlers ---
  const handleSelectTranslation = useCallback(
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
      } catch {
        Alert.alert(
          t('translations.downloadFailedTitle'),
          t('translations.translationDownloadFailed'),
        );
      }
    },
    [downloadTranslation, downloadingId, t],
  );

  const handleDelete = useCallback(
    (meta: DownloadedTranslationMeta) => {
      Alert.alert(
        t('translations.deleteTranslationTitle'),
        t('translations.deleteMessage', {
          name: getTranslationDisplayName({
            id: meta.identifier,
            englishName: meta.englishName,
          }),
        }),
        [
          {text: t('common:actions.cancel'), style: 'cancel'},
          {
            text: t('common:actions.delete'),
            style: 'destructive',
            onPress: async () => {
              if (selectedTranslationId === meta.identifier) {
                setSelectedTranslationId('saheeh');
              }
              await deleteTranslation(meta.identifier);
            },
          },
        ],
      );
    },
    [deleteTranslation, selectedTranslationId, setSelectedTranslationId, t],
  );

  // --- Tafseer handlers ---
  const handleSelectTafseer = useCallback(
    (id: string) => {
      lightHaptics();
      setSelectedTafseerId(id);
    },
    [setSelectedTafseerId],
  );

  const handleDownloadTafseer = useCallback(
    async (editionId: string) => {
      // Fire before the guard so a blocked tap still buzzes — acknowledge the tap.
      lightHaptics();
      // Own-state guard (see handleDownload) — tafaseer.db is separate from
      // translations.db, so a running translation download must not block this.
      if (tafseerDownloadingId) {
        showDownloadInProgressAlert();
        return;
      }
      try {
        await downloadTafseer(editionId);
      } catch {
        Alert.alert(
          t('translations.downloadFailedTitle'),
          t('translations.tafseerDownloadFailed'),
        );
      }
    },
    [downloadTafseer, tafseerDownloadingId, t],
  );

  const handleDeleteTafseer = useCallback(
    (meta: DownloadedTafseerMeta) => {
      Alert.alert(
        t('translations.deleteTafseerTitle'),
        t('translations.deleteMessage', {name: getTafseerDisplayName(meta)}),
        [
          {text: t('common:actions.cancel'), style: 'cancel'},
          {
            text: t('common:actions.delete'),
            style: 'destructive',
            onPress: async () => {
              await deleteTafseer(meta.identifier);
            },
          },
        ],
      );
    },
    [deleteTafseer, t],
  );

  // --- Flattened data for FlashList ---
  const translationData = useMemo((): FlatItem[] => {
    const items: FlatItem[] = [];

    // Build unified row list: bundled + downloaded + available
    const allRows: RowItem[] = [];

    for (const id of bundledIds) {
      const info = BUNDLED_TRANSLATIONS[id];
      allRows.push({
        type: 'row',
        id,
        name: info.name,
        englishName: info.name,
        language: 'en',
        isBundled: true,
        isDownloaded: true,
        isFirstInGroup: false,
        isLastInGroup: false,
      });
    }

    for (const meta of downloadedMeta) {
      if (isBundledTranslation(meta.identifier)) continue;
      allRows.push({
        type: 'row',
        id: meta.identifier,
        name: meta.name,
        englishName: meta.englishName,
        language: meta.language,
        isBundled: false,
        isDownloaded: true,
        isFirstInGroup: false,
        isLastInGroup: false,
      });
    }

    for (const edition of AVAILABLE_TRANSLATIONS) {
      if (downloadedIds.has(edition.identifier)) continue;
      if (isBundledTranslation(edition.identifier)) continue;
      allRows.push({
        type: 'row',
        id: edition.identifier,
        name: edition.name,
        englishName: edition.englishName,
        language: edition.language,
        isBundled: false,
        isDownloaded: false,
        isFirstInGroup: false,
        isLastInGroup: false,
      });
    }

    // Available section — downloaded items (excluding active)
    const availableRows = allRows
      .filter(r => r.isDownloaded && r.id !== selectedTranslationId)
      .sort((a, b) => a.englishName.localeCompare(b.englishName));

    if (availableRows.length > 0) {
      items.push({type: 'meta-header', title: t('translations.available')});
      availableRows.forEach((row, idx) => {
        row.isFirstInGroup = idx === 0;
        row.isLastInGroup = idx === availableRows.length - 1;
      });
      items.push(...availableRows);
    }

    // Language groups — only non-downloaded items
    const browseRows = allRows.filter(r => !r.isDownloaded);
    const byLang: Record<string, RowItem[]> = {};
    for (const row of browseRows) {
      (byLang[row.language] ??= []).push(row);
    }

    const sortedLangs = Object.keys(byLang).sort((a, b) => {
      if (a === 'en') return -1;
      if (b === 'en') return 1;
      return getLanguageDisplayName(a).localeCompare(
        getLanguageDisplayName(b),
        getIntlLocale(currentLanguage),
      );
    });

    for (const lang of sortedLangs) {
      const rows = byLang[lang].sort((a, b) =>
        a.englishName.localeCompare(b.englishName),
      );
      items.push({
        type: 'lang-header',
        title: getLanguageDisplayName(lang),
        count: rows.length,
      });
      rows.forEach((row, idx) => {
        row.isFirstInGroup = idx === 0;
        row.isLastInGroup = idx === rows.length - 1;
      });
      items.push(...rows);
    }

    return items;
  }, [selectedTranslationId, downloadedMeta, downloadedIds, t]);

  const tafseerData = useMemo((): FlatItem[] => {
    const items: FlatItem[] = [];

    const allRows: RowItem[] = [];

    for (const meta of tafseerDownloaded) {
      allRows.push({
        type: 'row',
        id: meta.identifier,
        name: meta.name,
        englishName: meta.englishName,
        language: normalizeTafseerLanguage(meta.language),
        isBundled: false,
        isDownloaded: true,
        isFirstInGroup: false,
        isLastInGroup: false,
      });
    }

    for (const edition of AVAILABLE_TAFASEER) {
      if (tafseerDownloadedIds.has(edition.identifier)) continue;
      allRows.push({
        type: 'row',
        id: edition.identifier,
        name: edition.name,
        englishName: edition.englishName,
        language: normalizeTafseerLanguage(edition.language),
        isBundled: false,
        isDownloaded: false,
        isFirstInGroup: false,
        isLastInGroup: false,
      });
    }

    // Put matching-language editions before other downloads for non-English
    // readers. The explicitly selected edition remains in the active card.
    const preferredRows =
      currentLanguage !== SOURCE_LANGUAGE
        ? allRows
            .filter(
              row =>
                row.id !== selectedTafseerId &&
                isPreferredTafseerLanguage(row.language),
            )
            .sort(compareTafaseer)
        : [];
    const preferredIds = new Set(preferredRows.map(row => row.id));
    if (preferredRows.length > 0) {
      items.push({
        type: 'lang-header',
        title: getLanguageDisplayName(currentLanguage),
        count: preferredRows.length,
      });
      preferredRows.forEach((row, idx) => {
        row.isFirstInGroup = idx === 0;
        row.isLastInGroup = idx === preferredRows.length - 1;
      });
      items.push(...preferredRows);
    }

    // Available section — downloaded items (excluding active)
    const availableRows = allRows
      .filter(
        r =>
          r.isDownloaded &&
          r.id !== selectedTafseerId &&
          !preferredIds.has(r.id),
      )
      .sort(compareTafaseer);

    if (availableRows.length > 0) {
      items.push({type: 'meta-header', title: t('translations.available')});
      availableRows.forEach((row, idx) => {
        row.isFirstInGroup = idx === 0;
        row.isLastInGroup = idx === availableRows.length - 1;
      });
      items.push(...availableRows);
    }

    // Language groups — only non-downloaded items
    const browseRows = allRows.filter(
      r => !r.isDownloaded && !preferredIds.has(r.id),
    );
    const byLang: Record<string, RowItem[]> = {};
    for (const row of browseRows) {
      (byLang[row.language] ??= []).push(row);
    }

    const sortedLangs = Object.keys(byLang).sort((a, b) => {
      return (
        Number(isPreferredTafseerLanguage(b)) -
          Number(isPreferredTafseerLanguage(a)) ||
        getTafseerLanguageDisplayName(a).localeCompare(
          getTafseerLanguageDisplayName(b),
          getIntlLocale(currentLanguage),
        )
      );
    });

    for (const lang of sortedLangs) {
      const rows = byLang[lang].sort(compareTafaseer);
      items.push({
        type: 'lang-header',
        title: getTafseerLanguageDisplayName(lang),
        count: rows.length,
      });
      rows.forEach((row, idx) => {
        row.isFirstInGroup = idx === 0;
        row.isLastInGroup = idx === rows.length - 1;
      });
      items.push(...rows);
    }

    return items;
  }, [selectedTafseerId, tafseerDownloaded, tafseerDownloadedIds, t]);

  const getItemType = useCallback((item: FlatItem) => item.type, []);

  const translationKeyExtractor = useCallback(
    (item: FlatItem, _index: number) => {
      if (item.type === 'meta-header' || item.type === 'lang-header') {
        return `trans-header-${item.title}`;
      }
      return `trans-${item.id}`;
    },
    [],
  );

  const tafseerKeyExtractor = useCallback((item: FlatItem, _index: number) => {
    if (item.type === 'meta-header' || item.type === 'lang-header') {
      return `tafseer-header-${item.title}`;
    }
    return `tafseer-${item.id}`;
  }, []);

  const translationListHeader = useMemo(() => {
    const activeName = getTranslationName(selectedTranslationId);
    const activeLang = isBundledTranslation(selectedTranslationId)
      ? getLanguageDisplayName('en')
      : getLanguageDisplayName(
          AVAILABLE_TRANSLATIONS.find(
            e => e.identifier === selectedTranslationId,
          )?.language ??
            downloadedMeta.find(m => m.identifier === selectedTranslationId)
              ?.language ??
            '',
        );
    return (
      <>
        <View style={styles.metaHeaderContainer}>
          <Text style={styles.metaHeader}>
            {t('translations.activeTranslation')}
          </Text>
        </View>
        <View style={styles.activeCard}>
          <View style={styles.activeCardText}>
            <Text style={styles.activeCardName} numberOfLines={1}>
              {activeName}
            </Text>
            <Text style={styles.activeCardLanguage}>{activeLang}</Text>
          </View>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>
              {t('translations.active')}
            </Text>
          </View>
        </View>
      </>
    );
  }, [selectedTranslationId, downloadedMeta, styles, t]);

  const tafseerListHeader = useMemo(() => {
    if (!selectedTafseerId) return null;
    const activeMeta = tafseerDownloaded.find(
      m => m.identifier === selectedTafseerId,
    );
    if (!activeMeta) return null;
    return (
      <>
        <View style={styles.metaHeaderContainer}>
          <Text style={styles.metaHeader}>
            {t('translations.activeTafseer')}
          </Text>
        </View>
        <View style={styles.activeCard}>
          <View style={styles.activeCardText}>
            <Text style={styles.activeCardName} numberOfLines={1}>
              {getTafseerDisplayName(activeMeta)}
            </Text>
            <Text style={styles.activeCardLanguage}>
              {getTafseerLanguageDisplayName(
                normalizeTafseerLanguage(activeMeta.language),
              )}
            </Text>
          </View>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>
              {t('translations.active')}
            </Text>
          </View>
        </View>
      </>
    );
  }, [selectedTafseerId, tafseerDownloaded, styles, t]);

  // --- Render ---
  const renderHeaderItem = useCallback(
    (item: FlatItem) => {
      if (item.type === 'meta-header') {
        return (
          <View style={styles.metaHeaderContainer}>
            <Text style={styles.metaHeader}>{item.title}</Text>
          </View>
        );
      }
      if (item.type === 'lang-header') {
        return (
          <View style={styles.langHeaderContainer}>
            <Text style={styles.langHeader}>{item.title}</Text>
            <Text style={styles.langCount}>{localizeDigits(item.count)}</Text>
          </View>
        );
      }
      return null;
    },
    [styles],
  );

  const renderTranslationItem = useCallback(
    ({item}: ListRenderItemInfo<FlatItem>) => {
      if (item.type !== 'row') return renderHeaderItem(item);
      return renderTranslationRow(item);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styles, theme, renderHeaderItem, renderTranslationRow],
  );

  const renderTafseerItem = useCallback(
    ({item}: ListRenderItemInfo<FlatItem>) => {
      if (item.type !== 'row') return renderHeaderItem(item);
      return renderTafseerRow(item);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styles, theme, renderHeaderItem, renderTafseerRow],
  );

  function renderTranslationRow(item: RowItem) {
    const isActive = item.id === selectedTranslationId;
    const isDownloading = item.id === downloadingId;
    const isReady = item.isBundled || item.isDownloaded;
    const isDeletable = item.isDownloaded && !item.isBundled;

    const cardStyle = [
      styles.cardRow,
      item.isFirstInGroup && styles.cardRowFirst,
      item.isLastInGroup && styles.cardRowLast,
      !(item.isFirstInGroup && item.isLastInGroup) &&
        !item.isFirstInGroup &&
        !item.isLastInGroup &&
        styles.cardRowMiddle,
      item.isFirstInGroup && item.isLastInGroup && styles.cardRowOnly,
    ];

    return (
      <View style={cardStyle}>
        <Pressable
          style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => {
            if (isReady) {
              handleSelectTranslation(item.id);
            } else if (!isDownloading) {
              handleDownload(item.id);
            }
          }}>
          <View style={styles.rowContent}>
            <Text
              style={[styles.rowName, isActive && styles.rowNameActive]}
              numberOfLines={1}>
              {getTranslationDisplayName(item)}
            </Text>
            {item.name !== item.englishName && (
              <Text style={styles.rowNativeName} numberOfLines={1}>
                {item.name}
              </Text>
            )}
          </View>
          {isDownloading ? (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color={theme.colors.text} />
              <Text style={styles.progressText}>
                {localizeDigits(`${Math.round(downloadProgress * 100)}%`)}
              </Text>
            </View>
          ) : isReady ? (
            <View style={styles.rowActions}>
              {isActive && <View style={styles.selectedDot} />}
              {isDeletable && (
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => {
                    const meta = downloadedMeta.find(
                      m => m.identifier === item.id,
                    );
                    if (meta) handleDelete(meta);
                  }}
                  hitSlop={8}>
                  <Feather
                    name="minus-circle"
                    size={moderateScale(14)}
                    color={Color(theme.colors.text).alpha(0.25).toString()}
                  />
                </Pressable>
              )}
            </View>
          ) : (
            <Feather
              name="arrow-down"
              size={moderateScale(16)}
              color={Color(theme.colors.text).alpha(0.35).toString()}
            />
          )}
        </Pressable>
        {!item.isLastInGroup && <View style={styles.cardDivider} />}
      </View>
    );
  }

  function renderTafseerRow(item: RowItem) {
    const isActive = item.id === selectedTafseerId;
    const isDownloading = item.id === tafseerDownloadingId;
    const isReady = item.isDownloaded;
    const isDeletable = item.isDownloaded;

    const cardStyle = [
      styles.cardRow,
      item.isFirstInGroup && styles.cardRowFirst,
      item.isLastInGroup && styles.cardRowLast,
      !(item.isFirstInGroup && item.isLastInGroup) &&
        !item.isFirstInGroup &&
        !item.isLastInGroup &&
        styles.cardRowMiddle,
      item.isFirstInGroup && item.isLastInGroup && styles.cardRowOnly,
    ];

    return (
      <View style={cardStyle}>
        <Pressable
          style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => {
            if (isReady) {
              handleSelectTafseer(item.id);
            } else if (!isDownloading) {
              handleDownloadTafseer(item.id);
            }
          }}>
          <View style={styles.rowContent}>
            <Text
              style={[styles.rowName, isActive && styles.rowNameActive]}
              numberOfLines={1}>
              {getTafseerDisplayName(item)}
            </Text>
            {currentLanguage !== SOURCE_LANGUAGE ? (
              <Text style={styles.rowNativeName} numberOfLines={1}>
                {getTafseerLanguageDisplayName(item.language)}
              </Text>
            ) : item.name !== item.englishName ? (
              <Text style={styles.rowNativeName} numberOfLines={1}>
                {item.name}
              </Text>
            ) : null}
          </View>
          {isDownloading ? (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color={theme.colors.text} />
              <Text style={styles.progressText}>
                {localizeDigits(
                  `${Math.round(tafseerDownloadProgress * 100)}%`,
                )}
              </Text>
            </View>
          ) : isReady ? (
            <View style={styles.rowActions}>
              {isActive && <View style={styles.selectedDot} />}
              {isDeletable && (
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => {
                    const meta = tafseerDownloaded.find(
                      m => m.identifier === item.id,
                    );
                    if (meta) handleDeleteTafseer(meta);
                  }}
                  hitSlop={8}>
                  <Feather
                    name="minus-circle"
                    size={moderateScale(14)}
                    color={Color(theme.colors.text).alpha(0.25).toString()}
                  />
                </Pressable>
              )}
            </View>
          ) : (
            <Feather
              name="arrow-down"
              size={moderateScale(16)}
              color={Color(theme.colors.text).alpha(0.35).toString()}
            />
          )}
        </Pressable>
        {!item.isLastInGroup && <View style={styles.cardDivider} />}
      </View>
    );
  }

  const handleTabChange = useCallback(
    (tab: ActiveTab) => {
      if (tab !== activeTab) {
        setActiveTab(tab);
      }
    },
    [activeTab],
  );

  // Place TabSelector in the navigation header — works in any Stack navigator
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'left',
      headerTintColor: theme.colors.text,
      headerBackButtonDisplayMode: 'minimal',
      headerTitle: () => (
        <TabSelector
          options={TAB_OPTIONS}
          selectedOption={activeTab}
          onSelect={handleTabChange}
          getLabel={tab =>
            tab === 'Translations'
              ? t('common:terms.translations')
              : t('common:terms.tafaseer')
          }
          width={moderateScale(220)}
        />
      ),
    });
  }, [navigation, activeTab, handleTabChange, theme.colors.text, t]);

  const translationEmptyComponent = useMemo(
    () => (
      <Text style={styles.emptyText}>{t('translations.noTranslations')}</Text>
    ),
    [styles, t],
  );

  const tafseerEmptyComponent = useMemo(
    () => <Text style={styles.emptyText}>{t('translations.noTafaseer')}</Text>,
    [styles, t],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.content, {paddingTop: headerHeight}]}>
        {/* Layered FlashLists — both stay mounted, toggle visibility */}
        <View style={{flex: 1}}>
          <View
            style={[
              StyleSheet.absoluteFill,
              {opacity: activeTab === 'Translations' ? 1 : 0},
            ]}
            pointerEvents={activeTab === 'Translations' ? 'auto' : 'none'}>
            <FlashList
              data={translationData}
              renderItem={renderTranslationItem}
              getItemType={getItemType}
              keyExtractor={translationKeyExtractor}
              ListHeaderComponent={translationListHeader}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: bottomInset + moderateScale(20),
              }}
              ListEmptyComponent={translationEmptyComponent}
            />
          </View>
          <View
            style={[
              StyleSheet.absoluteFill,
              {opacity: activeTab === 'Tafaseer' ? 1 : 0},
            ]}
            pointerEvents={activeTab === 'Tafaseer' ? 'auto' : 'none'}>
            <FlashList
              data={tafseerData}
              renderItem={renderTafseerItem}
              getItemType={getItemType}
              keyExtractor={tafseerKeyExtractor}
              ListHeaderComponent={tafseerListHeader}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: bottomInset + moderateScale(20),
              }}
              ListEmptyComponent={tafseerEmptyComponent}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
// @ai-end

// @ai-start
const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },

    // Fabric mirrors logical left alignment in RTL. Explicitly use the
    // leading edge for catalogue text rather than native 'natural' alignment.
    // Section headers — meta (ACTIVE TRANSLATION)
    metaHeaderContainer: {
      paddingHorizontal: moderateScale(18),
      paddingTop: moderateScale(12),
      paddingBottom: moderateScale(6),
    },
    metaHeader: {
      textAlign: 'left',
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: latinLetterSpacing(1.2),
      textTransform: 'uppercase',
    },

    // Section headers — language group (ENGLISH, ARABIC)
    langHeaderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(18),
      paddingTop: moderateScale(20),
      paddingBottom: moderateScale(8),
      gap: moderateScale(6),
    },
    langHeader: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: latinLetterSpacing(1.2),
      textTransform: 'uppercase',
    },
    langCount: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.35).toString(),
    },

    // Active card
    activeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: moderateScale(16),
      padding: moderateScale(14),
      borderRadius: moderateScale(14),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    activeCardText: {
      flex: 1,
    },
    activeCardName: {
      textAlign: 'left',
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    activeCardLanguage: {
      textAlign: 'left',
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: moderateScale(2),
    },
    activeBadge: {
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(4),
      borderRadius: moderateScale(8),
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    activeBadgeText: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.55).toString(),
      letterSpacing: latinLetterSpacing(0.3),
    },

    // Card grouping
    cardRow: {
      marginHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      overflow: 'hidden',
    },
    cardRowFirst: {
      borderTopWidth: 1,
      borderTopLeftRadius: moderateScale(12),
      borderTopRightRadius: moderateScale(12),
    },
    cardRowLast: {
      borderBottomWidth: 1,
      borderBottomLeftRadius: moderateScale(12),
      borderBottomRightRadius: moderateScale(12),
    },
    cardRowMiddle: {},
    cardRowOnly: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderRadius: moderateScale(12),
    },
    cardDivider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },

    // Rows
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(14),
    },
    rowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    deleteButton: {
      padding: moderateScale(6),
      borderRadius: moderateScale(8),
      marginLeft: moderateScale(6),
    },
    rowContent: {
      flex: 1,
      marginRight: moderateScale(10),
    },
    rowName: {
      textAlign: 'left',
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    rowNameActive: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    rowNativeName: {
      textAlign: 'left',
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: moderateScale(1),
    },

    // Selected dot indicator
    selectedDot: {
      width: moderateScale(8),
      height: moderateScale(8),
      borderRadius: moderateScale(4),
      backgroundColor: theme.colors.text,
    },

    // Progress
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
    },
    progressText: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },

    // Empty
    emptyText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      textAlign: 'center',
      paddingVertical: moderateScale(20),
    },
  });
// @ai-end
