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
import {SearchInput} from '@/components/SearchInput';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  buildTranslationPicker,
  useTranslationStore,
  type PickerTranslation,
} from '@/store/translationStore';
import {browsableTafaseer, useTafseerStore} from '@/store/tafseerStore';
import {
  tafseerDownloadFailure,
  translationDownloadFailure,
} from '@/services/content/contentNotices';
import {translationLanguageName} from '@/services/content/translationInstaller';
import {DEFAULT_TRANSLATION_ID} from '@/services/translation/translationRemap';
import {formatBytes} from '@/services/storageService';
import {
  getTranslationName,
  isBundledTranslation,
  registerRemoteTranslationName,
} from '@/utils/translationLookup';
import {
  BUNDLED_TRANSLATIONS,
  type DownloadedTranslationMeta,
} from '@/types/translation';
import type {DownloadedTafseerMeta} from '@/types/tafseer';
import {lightHaptics} from '@/utils/haptics';
import {useBottomInset} from '@/hooks/useBottomInset';
import {AVAILABLE_TAFASEER} from '@/data/availableTafaseer';

type ActiveTab = 'Translations' | 'Tafaseer';
const TAB_OPTIONS: ActiveTab[] = ['Translations', 'Tafaseer'];

// Shared so the translation and tafseer download handlers stay in sync.
const showDownloadInProgressAlert = () =>
  Alert.alert(
    'Download In Progress',
    'Please wait until the current download completes before starting another.',
  );

function normalizeTafseerLanguage(lang: string): string {
  return lang;
}

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

// Before any catalog is known: how to see more translations.
interface ConnectItem {
  type: 'connect';
}

type FlatItem = MetaHeaderItem | LangHeaderItem | RowItem | ConnectItem;

// A translation row: the name, with author and download size underneath.
function translationRow(translation: PickerTranslation): RowItem {
  const details = [
    translation.author,
    translation.isDownloaded || translation.bytes === null
      ? null
      : formatBytes(translation.bytes),
  ].filter((detail): detail is string => !!detail);
  return {
    type: 'row',
    id: translation.id,
    name: details.length > 0 ? details.join(' · ') : translation.name,
    englishName: translation.name,
    language: translation.language,
    isBundled: translation.isBundled,
    isDownloaded: translation.isDownloaded,
    isFirstInGroup: false,
    isLastInGroup: false,
  };
}

function markGroup(rows: RowItem[]): RowItem[] {
  rows.forEach((row, idx) => {
    row.isFirstInGroup = idx === 0;
    row.isLastInGroup = idx === rows.length - 1;
  });
  return rows;
}

export default function TranslationsContent() {
  const {theme} = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = USE_GLASS ? rawHeaderHeight : 0;
  const bottomInset = useBottomInset();

  const [activeTab, setActiveTab] = useState<ActiveTab>('Translations');

  // --- Translation state ---
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
  const [translationQuery, setTranslationQuery] = useState('');
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
  const offeredTafsirIds = useTafseerStore(s => s.offeredTafsirIds);
  const loadOfferedTafsirs = useTafseerStore(s => s.loadOfferedTafsirs);

  useEffect(() => {
    loadDownloadedMeta();
    loadOfferedTranslations();
    loadTafseerMeta();
    loadOfferedTafsirs();
  }, [
    loadDownloadedMeta,
    loadOfferedTranslations,
    loadTafseerMeta,
    loadOfferedTafsirs,
  ]);

  useEffect(() => {
    for (const meta of downloadedMeta) {
      registerRemoteTranslationName(meta.identifier, meta.englishName);
    }
    for (const edition of offeredTranslations ?? []) {
      registerRemoteTranslationName(edition.id, edition.name);
    }
  }, [downloadedMeta, offeredTranslations]);

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
      } catch (error) {
        const {title, message} = translationDownloadFailure(error);
        Alert.alert(title, message);
      }
    },
    [downloadTranslation, downloadingId],
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
                setSelectedTranslationId(DEFAULT_TRANSLATION_ID);
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
      } catch (error) {
        const {title, message} = tafseerDownloadFailure(error);
        Alert.alert(title, message);
      }
    },
    [downloadTafseer, tafseerDownloadingId],
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
  // Installed editions first, then the catalog grouped by language; before
  // any catalog is known, a short row says how to see more.
  const translationData = useMemo((): FlatItem[] => {
    const picker = buildTranslationPicker({
      downloaded: downloadedMeta,
      offered: offeredTranslations,
      selectedId: selectedTranslationId,
      query: translationQuery,
    });
    const items: FlatItem[] = [];

    if (picker.installed.length > 0) {
      items.push({type: 'meta-header', title: 'AVAILABLE'});
      items.push(...markGroup(picker.installed.map(translationRow)));
    }

    for (const group of picker.groups) {
      items.push({
        type: 'lang-header',
        title: group.language,
        count: group.rows.length,
      });
      items.push(...markGroup(group.rows.map(translationRow)));
    }

    if (picker.needsCatalog) items.push({type: 'connect'});

    return items;
  }, [
    selectedTranslationId,
    downloadedMeta,
    offeredTranslations,
    translationQuery,
  ]);

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

    for (const edition of browsableTafaseer(
      AVAILABLE_TAFASEER,
      tafseerDownloadedIds,
      offeredTafsirIds,
    )) {
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
  }, [
    selectedTafseerId,
    tafseerDownloaded,
    tafseerDownloadedIds,
    offeredTafsirIds,
  ]);

  const getItemType = useCallback((item: FlatItem) => item.type, []);

  const translationKeyExtractor = useCallback(
    (item: FlatItem, _index: number) => {
      if (item.type === 'meta-header' || item.type === 'lang-header') {
        return `trans-header-${item.title}`;
      }
      if (item.type === 'connect') return 'trans-connect';
      return `trans-${item.id}`;
    },
    [],
  );

  const tafseerKeyExtractor = useCallback((item: FlatItem, _index: number) => {
    if (item.type === 'meta-header' || item.type === 'lang-header') {
      return `tafseer-header-${item.title}`;
    }
    if (item.type === 'connect') return 'tafseer-connect';
    return `tafseer-${item.id}`;
  }, []);

  const translationListHeader = useMemo(() => {
    const activeName = getTranslationName(selectedTranslationId);
    const activeLang = isBundledTranslation(selectedTranslationId)
      ? BUNDLED_TRANSLATIONS[selectedTranslationId].language
      : (offeredTranslations?.find(e => e.id === selectedTranslationId)
          ?.language ??
        translationLanguageName(
          downloadedMeta.find(m => m.identifier === selectedTranslationId)
            ?.language,
        ) ??
        '');
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
        <SearchInput
          placeholder="Search translations..."
          value={translationQuery}
          onChangeText={setTranslationQuery}
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
    translationQuery,
    styles,
    theme.colors.text,
  ]);

  const tafseerListHeader = useMemo(() => {
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
  }, [selectedTafseerId, tafseerDownloaded, styles]);

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
            <Text style={styles.langCount}>{item.count}</Text>
          </View>
        );
      }
      if (item.type === 'connect') {
        return (
          <Text style={styles.emptyText}>Connect to see more translations</Text>
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
              {/* Engine downloads report no byte progress: spinner only. */}
              {tafseerDownloadProgress > 0 && (
                <Text style={styles.progressText}>
                  {Math.round(tafseerDownloadProgress * 100)}%
                </Text>
              )}
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
          width={moderateScale(220)}
        />
      ),
    });
  }, [navigation, activeTab, handleTabChange, theme.colors.text]);

  const translationEmptyComponent = useMemo(
    () => <Text style={styles.emptyText}>No translations found</Text>,
    [styles],
  );

  const tafseerEmptyComponent = useMemo(
    () => <Text style={styles.emptyText}>No tafaseer found</Text>,
    [styles],
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

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
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

    searchContainer: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(12),
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
