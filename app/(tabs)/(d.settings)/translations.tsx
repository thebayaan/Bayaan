import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {View, Text, Pressable, ActivityIndicator, Alert} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {Platform} from 'react-native';
import {useHeaderHeight} from '@react-navigation/elements';
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

type ActiveTab = 'translations' | 'tafaseer';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  tr: 'Turkish',
  ur: 'Urdu',
  id: 'Indonesian',
  ms: 'Malay',
  bn: 'Bengali',
  hi: 'Hindi',
  fa: 'Persian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  th: 'Thai',
  vi: 'Vietnamese',
  ha: 'Hausa',
  so: 'Somali',
  sw: 'Swahili',
  am: 'Amharic',
  az: 'Azerbaijani',
  bs: 'Bosnian',
  cs: 'Czech',
  dv: 'Dhivehi',
  ku: 'Kurdish',
  ml: 'Malayalam',
  no: 'Norwegian',
  ro: 'Romanian',
  sq: 'Albanian',
  ta: 'Tamil',
  tt: 'Tatar',
  ug: 'Uyghur',
  uz: 'Uzbek',
};

function getLanguageDisplayName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.charAt(0).toUpperCase() + code.slice(1);
}

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

export default function TranslationsScreen() {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = Platform.OS === 'ios' ? rawHeaderHeight : 0;
  const bottomInset = useBottomInset();

  const [activeTab, setActiveTab] = useState<ActiveTab>('translations');

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
      lightHaptics();
      try {
        await downloadTranslation(editionId);
      } catch {
        Alert.alert(
          'Download Failed',
          'Unable to download this translation. Please check your internet connection and try again.',
        );
      }
    },
    [downloadTranslation],
  );

  const handleDelete = useCallback(
    (meta: DownloadedTranslationMeta) => {
      Alert.alert(
        'Delete Translation',
        `Remove "${meta.englishName}"? You can download it again later.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
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
    [deleteTranslation, selectedTranslationId, setSelectedTranslationId],
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
      lightHaptics();
      try {
        await downloadTafseer(editionId);
      } catch {
        Alert.alert(
          'Download Failed',
          'Unable to download this tafseer. Please check your internet connection and try again.',
        );
      }
    },
    [downloadTafseer],
  );

  const handleDeleteTafseer = useCallback(
    (meta: DownloadedTafseerMeta) => {
      Alert.alert(
        'Delete Tafseer',
        `Remove "${meta.englishName}"? You can download it again later.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteTafseer(meta.identifier);
            },
          },
        ],
      );
    },
    [deleteTafseer],
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
      items.push({type: 'meta-header', title: 'AVAILABLE'});
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
      return getLanguageDisplayName(a).localeCompare(getLanguageDisplayName(b));
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
  }, [selectedTranslationId, downloadedMeta, downloadedIds]);

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

    // Available section — downloaded items (excluding active)
    const availableRows = allRows
      .filter(r => r.isDownloaded && r.id !== selectedTafseerId)
      .sort((a, b) => a.englishName.localeCompare(b.englishName));

    if (availableRows.length > 0) {
      items.push({type: 'meta-header', title: 'AVAILABLE'});
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
      if (a === 'English') return -1;
      if (b === 'English') return 1;
      return a.localeCompare(b);
    });

    for (const lang of sortedLangs) {
      const rows = byLang[lang].sort((a, b) =>
        a.englishName.localeCompare(b.englishName),
      );
      items.push({type: 'lang-header', title: lang, count: rows.length});
      rows.forEach((row, idx) => {
        row.isFirstInGroup = idx === 0;
        row.isLastInGroup = idx === rows.length - 1;
      });
      items.push(...rows);
    }

    return items;
  }, [selectedTafseerId, tafseerDownloaded, tafseerDownloadedIds]);

  const data = activeTab === 'translations' ? translationData : tafseerData;

  const getItemType = useCallback((item: FlatItem) => item.type, []);

  const keyExtractor = useCallback(
    (item: FlatItem, index: number) => {
      if (item.type === 'meta-header' || item.type === 'lang-header') {
        return `${activeTab}-header-${item.title}`;
      }
      return `${activeTab}-${item.id}`;
    },
    [activeTab],
  );

  const listHeader = useMemo(() => {
    if (activeTab === 'translations') {
      const activeName = getTranslationName(selectedTranslationId);
      const activeLang = isBundledTranslation(selectedTranslationId)
        ? 'English'
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
            <Text style={styles.metaHeader}>ACTIVE TRANSLATION</Text>
          </View>
          <View style={styles.activeCard}>
            <View style={styles.activeCardText}>
              <Text style={styles.activeCardName} numberOfLines={1}>
                {activeName}
              </Text>
              <Text style={styles.activeCardLanguage}>{activeLang}</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>
        </>
      );
    }

    // Tafaseer tab
    if (!selectedTafseerId) return null;
    const activeMeta = tafseerDownloaded.find(
      m => m.identifier === selectedTafseerId,
    );
    if (!activeMeta) return null;
    return (
      <>
        <View style={styles.metaHeaderContainer}>
          <Text style={styles.metaHeader}>ACTIVE TAFSEER</Text>
        </View>
        <View style={styles.activeCard}>
          <View style={styles.activeCardText}>
            <Text style={styles.activeCardName} numberOfLines={1}>
              {activeMeta.englishName}
            </Text>
            <Text style={styles.activeCardLanguage}>
              {normalizeTafseerLanguage(activeMeta.language)}
            </Text>
          </View>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        </View>
      </>
    );
  }, [
    activeTab,
    selectedTranslationId,
    selectedTafseerId,
    downloadedMeta,
    tafseerDownloaded,
    styles,
  ]);

  // --- Render ---
  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<FlatItem>) => {
      switch (item.type) {
        case 'meta-header':
          return (
            <View style={styles.metaHeaderContainer}>
              <Text style={styles.metaHeader}>{item.title}</Text>
            </View>
          );

        case 'lang-header':
          return (
            <View style={styles.langHeaderContainer}>
              <Text style={styles.langHeader}>{item.title}</Text>
              <Text style={styles.langCount}>{item.count}</Text>
            </View>
          );

        case 'row':
          if (activeTab === 'translations') {
            return renderTranslationRow(item);
          }
          return renderTafseerRow(item);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, styles, theme, renderTranslationRow, renderTafseerRow],
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
              {item.englishName}
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
                {Math.round(downloadProgress * 100)}%
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
              {item.englishName}
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
                {Math.round(tafseerDownloadProgress * 100)}%
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

  const emptyComponent = useMemo(
    () => (
      <Text style={styles.emptyText}>
        {activeTab === 'translations'
          ? 'No translations found'
          : 'No tafaseer found'}
      </Text>
    ),
    [activeTab, styles],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.content, {paddingTop: headerHeight}]}>
        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <View style={styles.tabTrack}>
            <Pressable
              style={[
                styles.tab,
                activeTab === 'translations' && styles.tabActive,
              ]}
              onPress={() => handleTabChange('translations')}>
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === 'translations'
                        ? theme.colors.text
                        : Color(theme.colors.textSecondary)
                            .alpha(0.6)
                            .toString(),
                    fontFamily:
                      activeTab === 'translations'
                        ? 'Manrope-SemiBold'
                        : 'Manrope-Medium',
                  },
                ]}>
                Translations
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'tafaseer' && styles.tabActive]}
              onPress={() => handleTabChange('tafaseer')}>
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === 'tafaseer'
                        ? theme.colors.text
                        : Color(theme.colors.textSecondary)
                            .alpha(0.6)
                            .toString(),
                    fontFamily:
                      activeTab === 'tafaseer'
                        ? 'Manrope-SemiBold'
                        : 'Manrope-Medium',
                  },
                ]}>
                Tafaseer
              </Text>
            </Pressable>
          </View>
        </View>

        <FlashList
          key={activeTab}
          data={data}
          renderItem={renderItem}
          getItemType={getItemType}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: bottomInset + moderateScale(20),
          }}
          ListEmptyComponent={emptyComponent}
        />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },

    // Tab selector
    tabContainer: {
      paddingHorizontal: moderateScale(16),
      marginBottom: moderateScale(12),
    },
    tabTrack: {
      flexDirection: 'row',
      borderRadius: moderateScale(10),
      padding: moderateScale(3),
      backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
    },
    tab: {
      flex: 1,
      paddingVertical: moderateScale(7),
      borderRadius: moderateScale(8),
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    tabText: {
      fontSize: moderateScale(12),
    },

    // Section headers — meta (ACTIVE TRANSLATION)
    metaHeaderContainer: {
      paddingHorizontal: moderateScale(18),
      paddingTop: moderateScale(12),
      paddingBottom: moderateScale(6),
    },
    metaHeader: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
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
      letterSpacing: 1.2,
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
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    activeCardLanguage: {
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
      letterSpacing: 0.3,
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
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    rowNameActive: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    rowNativeName: {
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
