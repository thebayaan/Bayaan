import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ListRenderItemInfo,
  ActivityIndicator,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useLocalSearchParams} from 'expo-router'; // @ai
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {PlayIcon, ShuffleIcon} from '@/components/Icons';
import {SheetManager} from 'react-native-actions-sheet';
import {useUploadsStore, getCustomReciterName} from '@/store/uploadsStore';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createUserUploadTrack, addUploadToRecentlyPlayed} from '@/utils/track';
// @ai-start
import {
  getSurahById,
  getReciterName,
  getReciterByIdSync,
} from '@/services/dataService';
// @ai-end
import {shuffleArray} from '@/utils/arrayUtils';
import Color from 'color';
import type {UploadedRecitation, RecordingType} from '@/types/uploads';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {pickAndImportAudioFiles} from '@/utils/importAudio';
// @ai-start
import {confirmRemoveAllUploads} from '@/utils/confirmRemoveAllUploads';
// @ai-end
import {usePlayerStore} from '@/services/player/store/playerStore';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {GradientText} from '@/components/GradientText';
import {ReciterImage} from '@/components/ReciterImage';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
// @ai-start
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {CollectionEmptyState} from '@/components/collection/CollectionEmptyState'; // @ai
import {
  PANEL_ART_GAP,
  PANEL_ART_RADIUS,
  PANEL_ART_SIZE,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PanelRow,
} from '@/components/collection/CollectionPanel'; // @ai
import i18n from '@/i18n';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  localizeDigits,
} from '@/i18n/format';
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
import {useIsStackRoot} from '@/components/tablet/useIsStackRoot'; // @ai
// @ai-start
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu';
import {
  CollectionOptionsMenu,
  type CollectionOptionsPayload,
} from '@/components/sheets/options/collectionOptions';
import {
  UploadOptionsMenu,
  type UploadOptionsPayload,
} from '@/components/sheets/options/uploadOptions';
// @ai-start
import {
  CollectionHeaderActions,
  CollectionScreenHeader,
  CollectionSearchField,
} from '@/components/collection/CollectionScreenHeader';
import {GRID_PADDING} from '@/components/collection/CollectionGridTile';
import {useCollectionViewPref} from '@/store/collectionViewStore';
import {matchesQuery} from '@/utils/collectionSearch';
// @ai-end
// @ai-end
// @ai-end

// @ai-start
const KNOWN_STYLES = ['murattal', 'mojawwad', 'molim'] as const;
// @ai-end

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

// @ai-start
function getDisplayTitle(item: UploadedRecitation): string {
  if (item.type === 'surah' && item.surahNumber) {
    const surah = getSurahById(item.surahNumber);
    if (surah) return getSurahDisplayName(surah);
  }
  if (item.type === 'other' && item.title) {
    return item.title;
  }
  return stripExtension(item.originalFilename);
}
// @ai-end

// @ai-start
function getDisplaySubtitle(item: UploadedRecitation): string {
  const parts: string[] = [];

  if (item.reciterId) {
    const reciter = getReciterByIdSync(item.reciterId);
    if (reciter) parts.push(getReciterDisplayName(reciter));
  } else if (item.customReciterId) {
    const name = getCustomReciterName(item.customReciterId);
    if (name) parts.push(name);
  }

  if (item.type === null) {
    parts.push(i18n.t('collection:uploadsScreen.untagged'));
  }

  return parts.length > 0
    ? parts.join(' \u00B7 ')
    : stripExtension(item.originalFilename);
}
// @ai-end

// @ai-start
function getVerseRangeLabel(item: UploadedRecitation): string | null {
  if (item.startVerse == null) return null;
  if (item.endVerse != null) {
    return localizeDigits(`${item.startVerse}-${item.endVerse}`);
  }
  return i18n.t('collection:uploadsScreen.verseShort', {
    verse: item.startVerse,
  });
}
// @ai-end

// @ai-start
function getRecordingTypeLabel(recordingType: RecordingType): string | null {
  if (recordingType === 'salah') {
    return i18n.t('collection:uploadsScreen.recordingType.salah');
  }
  if (recordingType === 'studio') {
    return i18n.t('collection:uploadsScreen.recordingType.studio');
  }
  return null;
}
// @ai-end

// @ai-start
function getCategoryLabel(
  category: NonNullable<UploadedRecitation['category']>,
): string {
  return i18n.t(`collection:uploadsScreen.category.${category}`);
}
// @ai-end

// @ai-start
function getStyleLabel(style: string): string {
  const known = KNOWN_STYLES.find(s => s === style.toLowerCase());
  if (known) return i18n.t(`common:styles.${known}`);
  return style.charAt(0).toUpperCase() + style.slice(1);
}
// @ai-end

interface UploadListItemProps {
  item: UploadedRecitation;
  index: number;
  onPlay: (item: UploadedRecitation, index: number) => void;
  onShowOptions: (item: UploadedRecitation, index: number) => void;
  /** Builds the ••• native menu on tablets. @ai */
  renderOptionsMenu?: (
    item: UploadedRecitation,
    index: number,
  ) => React.ReactNode;
}

// @ai-start
const UploadListItem: React.FC<UploadListItemProps> = React.memo(
  ({item, index, onPlay, onShowOptions, renderOptionsMenu}) => {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const playbackState = usePlayerStore(state => state.playback.state);
    const currentIndex = usePlayerStore(state => state.queue.currentIndex);
    const tracks = usePlayerStore(state => state.queue.tracks);

    const trackId = `upload-${item.id}`;

    const isCurrentTrack = useMemo(() => {
      const current =
        tracks && currentIndex >= 0 && currentIndex < tracks.length
          ? tracks[currentIndex]
          : null;
      return current?.id === trackId;
    }, [tracks, currentIndex, trackId]);

    const isPlaying =
      isCurrentTrack &&
      (playbackState === 'playing' || playbackState === 'buffering');

    const displaySubtitle = getDisplaySubtitle(item);

    const reciterName = useMemo(() => {
      if (!item.reciterId) return null;
      return getReciterName(item.reciterId);
    }, [item.reciterId]);

    // Build title with surah number prefix when applicable
    const displayTitle = useMemo(() => {
      if (item.type === 'surah' && item.surahNumber) {
        const surah = getSurahById(item.surahNumber);
        if (surah) {
          return `${localizeDigits(item.surahNumber)}. ${getSurahDisplayName(
            surah,
          )}`;
        }
      }
      return getDisplayTitle(item);
    }, [item]);

    return (
      <View style={styles.itemRow}>
        <Pressable
          style={styles.itemPlayZone}
          onPress={() => onPlay(item, index)}
          onLongPress={() => onShowOptions(item, index)}>
          {reciterName ? (
            <ReciterImage
              reciterName={reciterName}
              style={styles.itemReciterImage}
            />
          ) : (
            <View style={styles.itemIconContainer}>
              <Feather
                name="music"
                size={moderateScale(18)}
                color={theme.colors.textSecondary}
              />
            </View>
          )}
          <View style={styles.itemInfoContainer}>
            <View style={styles.itemNameRow}>
              {isCurrentTrack ? (
                <GradientText
                  style={styles.itemName}
                  surahId={item.surahNumber ?? 0}>
                  {displayTitle}
                </GradientText>
              ) : (
                <Text
                  style={styles.itemName}
                  numberOfLines={1}
                  ellipsizeMode="middle">
                  {displayTitle}
                </Text>
              )}
              {item.startVerse != null && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{getVerseRangeLabel(item)}</Text>
                </View>
              )}
              {item.recordingType != null && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>
                    {getRecordingTypeLabel(item.recordingType)}
                  </Text>
                </View>
              )}
              {item.type === 'other' && item.category && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>
                    {getCategoryLabel(item.category)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.itemSecondaryRow}>
              <Text style={styles.itemSecondaryText} numberOfLines={1}>
                {displaySubtitle}
              </Text>
            </View>
            {item.type === 'surah' && item.rewayah && (
              <Text style={styles.itemTertiaryText}>
                {item.rewayah}
                {item.style ? ` \u00B7 ${getStyleLabel(item.style)}` : ''}
              </Text>
            )}
          </View>
        </Pressable>
        <Pressable
          style={styles.itemOptionsZone}
          accessibilityRole="button"
          accessibilityLabel={i18n.t(
            'collection:collectionScreen.actions.moreOptions',
          )}
          onPress={() => onShowOptions(item, index)}>
          {isCurrentTrack ? (
            <NowPlayingIndicator
              isPlaying={isPlaying}
              barCount={3}
              surahId={item.surahNumber ?? 0}
            />
          ) : (
            <Feather
              name="more-horizontal"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
          )}
          {renderOptionsMenu?.(item, index)}
        </Pressable>
      </View>
    );
  },
);
// @ai-end

UploadListItem.displayName = 'UploadListItem';

// @ai-start
export default function UploadsScreen() {
  const {theme} = useTheme();
  const listBottomPadding = useLibraryListBottomPadding(); // @ai
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The iPad sidebar opens this as the first screen of the Collection stack.
  // Back then has nothing to pop and used to switch to the Home tab, so the
  // arrow is left out there, as the system header does on iPadOS 26. @ai
  const isStackRoot = useIsStackRoot(); // @ai
  const {t} = useTranslation(['collection', 'common']);
  const {
    recitations: storeRecitations, // @ai sorted below
    totalCount,
    importFile,
    importFiles,
    loadRecitations,
    deleteAllRecitations,
  } = useUploadsStore();
  const {updateQueue, addToQueue, play} = usePlayerActions();

  const [isImporting, setIsImporting] = useState(false);

  // @ai-start
  // The order picked in the sort menu; Play all and a row's queue follow it.
  const {sort} = useCollectionViewPref('uploads');
  // @ai A search typed on the Collection tab arrives as `q`.
  const {q: initialQuery} = useLocalSearchParams<{q?: string}>(); // @ai
  const [searching, setSearching] = useState(Boolean(initialQuery));
  const [query, setQuery] = useState(initialQuery ?? '');
  const uploadTitle = useCallback((r: UploadedRecitation) => {
    if (r.title) return r.title;
    const surah = r.surahNumber ? getSurahById(r.surahNumber) : undefined;
    return surah ? getSurahDisplayName(surah) : r.originalFilename;
  }, []);
  const recitations = useMemo(() => {
    const list = [...storeRecitations];
    if (sort === 'oldest') list.sort((a, b) => a.dateAdded - b.dateAdded);
    else if (sort === 'title') {
      list.sort((a, b) => uploadTitle(a).localeCompare(uploadTitle(b)));
    } else list.sort((a, b) => b.dateAdded - a.dateAdded);
    return list;
  }, [storeRecitations, sort, uploadTitle]);
  const visibleRecitations = useMemo(
    () =>
      searching && query.trim()
        ? recitations.filter(r => {
            const surah = r.surahNumber
              ? getSurahById(r.surahNumber)
              : undefined;
            return matchesQuery(query, [
              uploadTitle(r),
              r.originalFilename,
              surah?.name,
              surah?.translated_name_english,
              r.category,
            ]);
          })
        : recitations,
    [recitations, searching, query, uploadTitle],
  );
  // @ai-end

  // Scroll tracking for sticky header
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    loadRecitations();
  }, [loadRecitations]);

  // @ai-start
  const optionsPayload = useMemo<CollectionOptionsPayload>(
    () => ({
      title: t('common:terms.uploads'),
      subtitle: t('uploadsScreen.recitationsCount', {count: totalCount}),
      options: [
        {
          label: t('uploadsScreen.removeAll'),
          icon: 'trash-2',
          destructive: true,
          onPress: () => confirmRemoveAllUploads(deleteAllRecitations),
        },
      ],
    }),
    [totalCount, deleteAllRecitations, t],
  );

  const handleOptionsMenu = useCallback(() => {
    SheetManager.show('collection-options', {payload: optionsPayload});
  }, [optionsPayload]);

  const renderHeaderRight = useCallback(
    () =>
      searching ? null : (
        <CollectionHeaderActions
          screen="uploads"
          onSearch={() => setSearching(true)}
          extra={
            <CollectionOptionsMenu payload={optionsPayload}>
              <Pressable
                onPress={handleOptionsMenu}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('collectionScreen.actions.moreOptions')}>
                <Feather
                  name="more-horizontal"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
              </Pressable>
            </CollectionOptionsMenu>
          }
        />
      ),
    [optionsPayload, handleOptionsMenu, theme.colors.text, searching],
  );
  // @ai-end

  useCollectionNativeHeader({
    title: t('common:terms.uploads'),
    scrollY,
    hasContent: recitations.length > 0,
    headerRight: recitations.length > 0 ? renderHeaderRight : undefined,
  });

  const handleOrganize = useCallback((item: UploadedRecitation) => {
    SheetManager.show('organize-recitation', {
      payload: {recitation: item},
    });
  }, []);

  const handleImportFile = useCallback(async () => {
    setIsImporting(true);
    try {
      await pickAndImportAudioFiles({
        importFile,
        importFiles,
        onOrganize: handleOrganize,
      });
    } catch (error) {
      console.error('Error importing files:', error);
    } finally {
      setIsImporting(false);
    }
  }, [importFile, importFiles, handleOrganize]);

  const handlePlayAll = useCallback(async () => {
    if (recitations.length === 0) return;
    try {
      const tracks = recitations.map(createUserUploadTrack);
      await updateQueue(tracks, 0);
      await play();
      addUploadToRecentlyPlayed(recitations[0]);
    } catch (error) {
      console.error('Error playing all uploads:', error);
    }
  }, [recitations, updateQueue, play]);

  const handleShuffle = useCallback(async () => {
    if (recitations.length === 0) return;
    try {
      const shuffled = shuffleArray([...recitations]);
      const tracks = shuffled.map(createUserUploadTrack);
      await updateQueue(tracks, 0);
      await play();
      addUploadToRecentlyPlayed(shuffled[0]);
    } catch (error) {
      console.error('Error shuffling uploads:', error);
    }
  }, [recitations, updateQueue, play]);

  const handlePlayRecitation = useCallback(
    async (item: UploadedRecitation, index: number) => {
      try {
        const tracks = recitations.map(createUserUploadTrack);
        await updateQueue(tracks, index);
        await play();
        addUploadToRecentlyPlayed(item);
      } catch (error) {
        console.error('Error playing uploaded recitation:', error);
      }
    },
    [recitations, updateQueue, play],
  );

  // @ai-start
  const buildUploadOptions = useCallback(
    (item: UploadedRecitation, index: number): UploadOptionsPayload => ({
      recitation: item,
      reciterId: item.reciterId || '',
      onPlay: () => handlePlayRecitation(item, index),
      onAddToQueue: () => {
        addToQueue([createUserUploadTrack(item)]);
      },
    }),
    [handlePlayRecitation, addToQueue],
  );

  const handleShowOptions = useCallback(
    (item: UploadedRecitation, index: number) => {
      SheetManager.show('upload-options', {
        payload: buildUploadOptions(item, index),
      });
    },
    [buildUploadOptions],
  );

  const nativeMenus = useNativeOptionsMenu();
  const renderOptionsMenu = useCallback(
    (item: UploadedRecitation, index: number) => (
      <UploadOptionsMenu payload={buildUploadOptions(item, index)} />
    ),
    [buildUploadOptions],
  );
  // @ai-end

  const styles = useMemo(() => createStyles(theme), [theme]);
  const hasRecitations = recitations.length > 0;

  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<UploadedRecitation>) => (
      <PanelRow
        first={index === 0}
        last={index === visibleRecitations.length - 1}>
        <UploadListItem
          item={item}
          // @ai The row's place in the whole sorted list, so a search
          // result still queues from where it sits among all uploads.
          index={searching ? recitations.indexOf(item) : index}
          onPlay={handlePlayRecitation}
          onShowOptions={handleShowOptions}
          renderOptionsMenu={nativeMenus ? renderOptionsMenu : undefined}
        />
      </PanelRow>
    ),
    [
      visibleRecitations.length, // @ai
      handlePlayRecitation,
      handleShowOptions,
      nativeMenus,
      renderOptionsMenu,
      searching, // @ai
      recitations, // @ai
    ],
  );

  const keyExtractor = useCallback((item: UploadedRecitation) => item.id, []);

  if (!hasRecitations) {
    // @ai The empty screen keeps the full screen's frame.
    return (
      <CollectionEmptyState
        category="uploads"
        title={t('common:terms.uploads')}
        meta={t('collectionScreen.emptyState.uploads.meta')}
        heading={t('collectionScreen.emptyState.uploads.heading')}
        message={t('collectionScreen.emptyState.uploads.message')}
        showBack={!isStackRoot}
        primary={{
          label: isImporting
            ? t('uploadsScreen.opening')
            : t('uploadsScreen.addRecitation'),
          icon: (
            <Feather
              name="plus"
              size={moderateScale(16)}
              color={theme.colors.background}
            />
          ),
          onPress: handleImportFile,
          disabled: isImporting,
        }}
      />
    );
  }

  // @ai-start
  const listHeader = searching ? (
    <CollectionSearchField
      value={query}
      onChangeText={setQuery}
      onCancel={() => {
        setSearching(false);
        setQuery('');
      }}
      placeholder={t('collectionScreen.search.placeholderIn', {
        name: t('common:terms.uploads'),
      })}
      resultLabel={
        query.trim()
          ? t('collectionScreen.search.matches', {
              count: visibleRecitations.length,
            })
          : undefined
      }
      style={{
        paddingHorizontal: GRID_PADDING,
        paddingTop: USE_GLASS ? moderateScale(8) : insets.top + 8,
        paddingBottom: moderateScale(12),
      }}
    />
  ) : (
    <CollectionScreenHeader
      category="uploads"
      preview={null}
      title={t('common:terms.uploads')}
      meta={t('uploadsScreen.recitationsCount', {count: totalCount})}
      primary={{
        label: t('collectionScreen.actions.playAll'),
        icon: (
          <PlayIcon color={theme.colors.background} size={moderateScale(15)} />
        ),
        onPress: handlePlayAll,
      }}
      secondary={[
        {
          label: t('common:actions.shuffle'),
          icon: (
            <ShuffleIcon color={theme.colors.text} size={moderateScale(15)} />
          ),
          onPress: handleShuffle,
        },
        {
          label: isImporting
            ? t('uploadsScreen.opening')
            : t('uploadsScreen.addRecitation'),
          icon: isImporting ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <Feather
              name="plus"
              size={moderateScale(15)}
              color={theme.colors.text}
            />
          ),
          onPress: handleImportFile,
          disabled: isImporting,
        },
      ]}
      actions={renderHeaderRight()}
    />
  );
  // @ai-end

  return (
    <View style={styles.container}>
      {/* Not at the stack root: nothing to go back to. @ai */}
      {!USE_GLASS && !isStackRoot && (
        <RNAnimated.View
          style={[
            styles.fixedBackButton,
            {
              top: insets.top + moderateScale(10),
            },
            {
              opacity: scrollY.interpolate({
                inputRange: [80, 120],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(24)}
              color={theme.colors.text}
              style={flipX}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      <RNAnimated.FlatList
        data={visibleRecitations} // @ai
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader} // @ai
        keyboardShouldPersistTaps="handled" // @ai
        keyboardDismissMode="on-drag" // @ai
        contentContainerStyle={[
          styles.listContentContainer,
          {paddingBottom: listBottomPadding}, // @ai
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
      />
      {!USE_GLASS && (
        <CollectionStickyHeader
          title={t('common:terms.uploads')}
          scrollY={scrollY}
        />
      )}
    </View>
  );
}
// @ai-end

// @ai-start
const createStyles = (theme: {colors: any; fonts: any}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      width: '100%',
      overflow: 'hidden',
    },
    contentArea: {
      width: '100%',
      alignItems: 'center',
      paddingBottom: moderateScale(10),
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    contentCenter: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(20),
    },
    heroIconContainer: {
      width: moderateScale(64),
      height: moderateScale(64),
      borderRadius: moderateScale(32),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.1).toString(),
    },
    heroIconInner: {
      width: moderateScale(56),
      height: moderateScale(56),
      borderRadius: moderateScale(28),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
    },
    title: {
      fontSize: moderateScale(17),
      fontFamily: theme.fonts?.bold || 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(8),
      letterSpacing: latinLetterSpacing(-0.3),
    },
    subtitle: {
      fontSize: moderateScale(12),
      color: theme.colors.text,
      fontFamily: theme.fonts?.regular || 'Manrope-Regular',
      textAlign: 'center',
      marginBottom: moderateScale(8),
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: moderateScale(4),
      paddingBottom: moderateScale(12),
      paddingHorizontal: moderateScale(20),
      gap: moderateScale(16),
    },
    uploadBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(12),
      marginHorizontal: moderateScale(16),
      marginTop: moderateScale(8),
      marginBottom: moderateScale(8),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(8),
    },
    uploadBarText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
    },
    circleButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      padding: moderateScale(8),
    },
    playButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      backgroundColor: theme.colors.text,
    },
    playIconContainer: {
      paddingLeft: moderateScale(4),
    },
    disabledButton: {
      opacity: 0.4,
    },
    listContentContainer: {
      flexGrow: 1,
    },
    fixedBackButton: {
      position: 'absolute',
      left: moderateScale(15),
      zIndex: 5,
      padding: moderateScale(8),
    },
    emptyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: moderateScale(12),
      paddingHorizontal: moderateScale(16),
    },
    emptyHeaderBack: {
      width: moderateScale(36),
      height: moderateScale(36),
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyHeaderTitle: {
      flex: 1,
      fontSize: moderateScale(17),
      fontFamily: theme.fonts?.bold || 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    emptyContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: moderateScale(32),
      paddingBottom: moderateScale(60),
    },
    emptyIcon: {
      marginBottom: moderateScale(16),
    },
    emptyTitle: {
      fontSize: moderateScale(17),
      fontFamily: theme.fonts?.bold || 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(8),
    },
    emptySubtitle: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts?.regular || 'Manrope-Regular',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: moderateScale(20),
    },
    emptyActionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(32),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(8),
    },
    emptyActionText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    itemPlayZone: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: PANEL_ROW_VERTICAL,
      paddingStart: PANEL_ROW_PADDING,
    },
    itemIconContainer: {
      width: PANEL_ART_SIZE,
      height: PANEL_ART_SIZE,
      borderRadius: PANEL_ART_RADIUS,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginEnd: PANEL_ART_GAP,
    },
    itemReciterImage: {
      width: PANEL_ART_SIZE,
      height: PANEL_ART_SIZE,
      borderRadius: PANEL_ART_RADIUS,
      marginEnd: PANEL_ART_GAP,
    },
    itemInfoContainer: {
      flex: 1,
    },
    itemNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
    },
    itemName: {
      flexShrink: 1,
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    itemSecondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      marginBottom: moderateScale(2),
    },
    itemSecondaryText: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    itemTertiaryText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
    },
    itemOptionsZone: {
      width: '20%' as any,
      minWidth: moderateScale(50),
      maxWidth: moderateScale(70),
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(8),
      paddingRight: moderateScale(12),
      alignSelf: 'stretch',
    },
    tag: {
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(1),
      borderRadius: moderateScale(4),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    tagText: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
    },
  });
// @ai-end
