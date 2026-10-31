// @ai-generated
import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  SectionList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {moderateScale} from '@/utils/scale';
import {SearchInput} from '@/components/SearchInput';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useReciterStore} from '@/store/reciterStore';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {useSettings} from '@/hooks/useSettings';
import {useBottomInset} from '@/hooks/useBottomInset';
import {rankReciters} from '@/utils/search/catalog';
import {pickRewayatId} from '@/utils/rewayatPreference';
import {getReciterDisplayName} from '@/i18n/format';
import {lightHaptics} from '@/utils/haptics';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {DefaultReciterHero} from '@/components/default-reciter/DefaultReciterHero';
import {PlaybackModeSwitch} from '@/components/default-reciter/PlaybackModeSwitch';
import {FavoritesShelf} from '@/components/default-reciter/FavoritesShelf';
import {ReciterGridRow} from '@/components/default-reciter/ReciterGridRow';
import {UndoToast} from '@/components/default-reciter/UndoToast';
import {
  useReciterPreview,
  previewKey,
} from '@/components/default-reciter/useReciterPreview';
import {
  ReciterSection,
  buildReciterSections,
  completeRewayat,
  hasCompleteQuran,
  recitationLabels,
  toRows,
} from '@/components/default-reciter/reciterSections';
import {
  ROW_INSET,
  SECTION_GAP,
  settingsTokens,
} from '@/components/default-reciter/settingsTokens';

// The `expanded` width class (docs/design/ipad-standards.md §2).
const EXPANDED_MIN_WIDTH = 900;
const HERO_COLUMN_WIDTH = 340;
const KNOWN_STYLES = ['murattal', 'mojawwad', 'molim'] as const;

export default function DefaultReciterScreen() {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const {t: tCommon} = useTranslation('common');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {width} = useWindowDimensions();
  const expanded = width >= EXPANDED_MIN_WIDTH;
  const columns = expanded ? 2 : 1;
  const bottomInset = useBottomInset();
  // Under a glass header the screen starts at the top of the window.
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = USE_GLASS ? rawHeaderHeight : 0;

  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const setDefaultReciter = useReciterStore(state => state.setDefaultReciter);
  const catalogReady = useReciterStore(state => state.isInitialized);
  const reciterPreferences = useSettings(state => state.reciterPreferences);
  const setReciterPreference = useSettings(state => state.setReciterPreference);
  const favoriteIds = useFavoriteRecitersStore(
    state => state.favoriteReciterIds,
  );
  const preview = useReciterPreview();

  const [query, setQuery] = useState('');
  const [undo, setUndo] = useState<{
    previousId: string;
    message: string;
  } | null>(null);

  // Only reciters with the full Quran can be the default.
  const complete = useMemo(
    () => (catalogReady ? RECITERS.filter(hasCompleteQuran) : []),
    [catalogReady],
  );

  const styleLabel = useCallback(
    (style: string) => {
      const known = KNOWN_STYLES.find(s => s === style);
      return known
        ? tCommon(`styles.${known}`)
        : style.charAt(0).toUpperCase() + style.slice(1);
    },
    [tCommon],
  );

  const rewayat = useMemo(
    () => completeRewayat(defaultReciter),
    [defaultReciter],
  );
  const labels = useMemo(
    () => recitationLabels(rewayat, styleLabel),
    [rewayat, styleLabel],
  );
  const selectedRewayatId =
    pickRewayatId(rewayat, [reciterPreferences[defaultReciter.id]]) ?? '';

  const favoriteReciters = useMemo(
    () =>
      favoriteIds
        .map(id => complete.find(r => r.id === id))
        .filter((r): r is Reciter => !!r),
    [favoriteIds, complete],
  );

  const sections: ReciterSection[] = useMemo(() => {
    if (query.trim()) {
      const results = [...rankReciters(query, complete)];
      return results.length > 0
        ? [{key: 'results', title: '', data: toRows(results, columns)}]
        : [];
    }
    return buildReciterSections(complete, getReciterDisplayName, columns);
  }, [query, complete, columns]);

  const handlePick = useCallback(
    (reciter: Reciter) => {
      if (reciter.id === defaultReciter.id) return;
      lightHaptics();
      preview.stop();
      const previousId = defaultReciter.id;
      setDefaultReciter(reciter);
      setUndo({
        previousId,
        message: t('defaultReciter.nowDefault', {
          name: getReciterDisplayName(reciter),
        }),
      });
    },
    [defaultReciter.id, preview, setDefaultReciter, t],
  );

  const handleUndo = useCallback(() => {
    const previous = undo && RECITERS.find(r => r.id === undo.previousId);
    if (previous) setDefaultReciter(previous);
    setUndo(null);
  }, [undo, setDefaultReciter]);

  const dismissUndo = useCallback(() => setUndo(null), []);

  const handleSelectRewayat = useCallback(
    (rewayatId: string) => {
      lightHaptics();
      preview.stop();
      setReciterPreference(defaultReciter.id, rewayatId);
    },
    [defaultReciter.id, preview, setReciterPreference],
  );

  const handleTogglePreview = useCallback(() => {
    if (selectedRewayatId) preview.toggle(defaultReciter, selectedRewayatId);
  }, [preview, defaultReciter, selectedRewayatId]);

  const hero = defaultReciter.id ? (
    <DefaultReciterHero
      reciter={defaultReciter}
      rewayat={rewayat}
      labels={labels}
      selectedRewayatId={selectedRewayatId}
      onSelectRewayat={handleSelectRewayat}
      isPlaying={
        preview.playingKey === previewKey(defaultReciter.id, selectedRewayatId)
      }
      progress={preview.progress}
      onTogglePreview={handleTogglePreview}
      artworkSize={expanded ? 196 : moderateScale(148)}
    />
  ) : null;

  const listHeader = (
    <View style={styles.header}>
      {!expanded && hero}
      {!expanded && (
        <View style={styles.block}>
          <PlaybackModeSwitch />
        </View>
      )}
      {!query.trim() && (
        <View style={expanded ? undefined : styles.block}>
          <FavoritesShelf
            reciters={favoriteReciters}
            currentId={defaultReciter.id}
            onPick={handlePick}
            avatarSize={expanded ? 72 : moderateScale(60)}
          />
        </View>
      )}
      <View style={styles.allHeader}>
        <Text style={styles.sectionTitle}>{t('defaultReciter.all')}</Text>
        <Text style={styles.count}>
          {t('defaultReciter.fullQuranCount', {count: complete.length})}
        </Text>
      </View>
      <SearchInput
        placeholder={t('defaultReciter.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        showCancelButton={false}
        iconColor={theme.colors.text}
        iconOpacity={0.5}
        placeholderTextColor={Color(theme.colors.text).alpha(0.5).toString()}
        textColor={theme.colors.text}
        backgroundColor={Color(theme.colors.text).alpha(0.06).toString()}
        borderColor="transparent"
        containerStyle={styles.search}
      />
    </View>
  );

  const list = (
    <SectionList
      sections={sections}
      keyExtractor={(row, index) => row[0]?.id ?? String(index)}
      renderItem={({item, index, section}) => (
        <ReciterGridRow
          reciters={item}
          columns={columns}
          currentId={defaultReciter.id}
          isFirst={index === 0}
          isLast={index === section.data.length - 1}
          onPick={handlePick}
        />
      )}
      renderSectionHeader={({section}) =>
        section.title ? (
          <Text style={styles.letter}>{section.title}</Text>
        ) : null
      }
      renderSectionFooter={() => <View style={styles.sectionGap} />}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {catalogReady ? t('defaultReciter.noResults') : null}
        </Text>
      }
      stickySectionHeadersEnabled={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.listContent,
        {paddingBottom: bottomInset + moderateScale(80)},
      ]}
    />
  );

  return (
    <View style={styles.container}>
      {expanded ? (
        <View style={styles.split}>
          <ScrollView
            style={styles.heroColumn}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.heroColumnContent}>
            {hero}
            <View style={styles.block}>
              <PlaybackModeSwitch />
            </View>
          </ScrollView>
          <View style={styles.listColumn}>{list}</View>
        </View>
      ) : (
        list
      )}
      {undo && (
        <UndoToast
          key={undo.message}
          message={undo.message}
          top={headerHeight + moderateScale(8)}
          onUndo={handleUndo}
          onDismiss={dismissUndo}
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => {
  const tokens = settingsTokens(theme);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    split: {
      flex: 1,
      flexDirection: 'row',
      gap: 32,
      paddingHorizontal: 32,
    },
    heroColumn: {
      width: HERO_COLUMN_WIDTH,
      flexGrow: 0,
    },
    heroColumnContent: {
      paddingTop: 22,
      paddingBottom: 40,
    },
    listColumn: {
      flex: 1,
      minWidth: 0,
    },
    listContent: {
      paddingHorizontal: moderateScale(16),
    },
    header: {
      paddingTop: moderateScale(8),
    },
    block: {
      marginTop: SECTION_GAP,
    },
    allHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: SECTION_GAP,
      marginEnd: ROW_INSET,
    },
    sectionTitle: tokens.header,
    count: {
      fontSize: tokens.smallSize,
      fontFamily: 'Manrope-Regular',
      color: tokens.secondary,
    },
    search: {
      paddingHorizontal: 0,
      marginBottom: SECTION_GAP,
    },
    letter: tokens.header,
    sectionGap: {
      height: SECTION_GAP,
    },
    empty: {
      fontSize: tokens.smallSize,
      fontFamily: 'Manrope-Regular',
      color: tokens.secondary,
      textAlign: 'center',
      paddingVertical: moderateScale(16),
    },
  });
};
