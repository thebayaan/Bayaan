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
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {MicrophoneIcon, PlayIcon, ShuffleIcon} from '@/components/Icons';
import {SheetManager} from 'react-native-actions-sheet';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
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
import {flipX, forceLTR, latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import i18n from '@/i18n';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  localizeDigits,
} from '@/i18n/format';
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
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
  const {t} = useTranslation(['collection', 'common']);
  const {
    recitations,
    totalCount,
    importFile,
    importFiles,
    loadRecitations,
    deleteAllRecitations,
  } = useUploadsStore();
  const {updateQueue, addToQueue, play} = usePlayerActions();

  const [isImporting, setIsImporting] = useState(false);

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
    () => (
      <CollectionOptionsMenu payload={optionsPayload}>
        <Pressable onPress={handleOptionsMenu} hitSlop={8}>
          <Feather
            name="more-horizontal"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
      </CollectionOptionsMenu>
    ),
    [optionsPayload, handleOptionsMenu, theme.colors.text],
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
      showSheet('upload-options', {
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
      <UploadListItem
        item={item}
        index={index}
        onPlay={handlePlayRecitation}
        onShowOptions={handleShowOptions}
        renderOptionsMenu={nativeMenus ? renderOptionsMenu : undefined}
      />
    ),
    [handlePlayRecitation, handleShowOptions, nativeMenus, renderOptionsMenu],
  );

  const keyExtractor = useCallback((item: UploadedRecitation) => item.id, []);

  if (!hasRecitations) {
    return (
      <View style={styles.container}>
        {!USE_GLASS && (
          <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
            <Pressable
              style={styles.emptyHeaderBack}
              onPress={() => router.back()}
              hitSlop={8}>
              <Feather
                name="arrow-left"
                size={moderateScale(22)}
                color={theme.colors.text}
                style={flipX}
              />
            </Pressable>
            <Text style={styles.emptyHeaderTitle}>
              {t('common:terms.uploads')}
            </Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <MicrophoneIcon
              color={theme.colors.textSecondary}
              size={moderateScale(48)}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {t('collectionScreen.empty.uploads')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('uploadsScreen.emptySubtitle')}
          </Text>
          <Pressable
            style={styles.emptyActionBar}
            onPress={handleImportFile}
            disabled={isImporting}>
            {isImporting ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.textSecondary}
              />
            ) : (
              <Feather
                name="plus"
                size={moderateScale(16)}
                color={theme.colors.textSecondary}
              />
            )}
            <Text style={styles.emptyActionText}>
              {isImporting
                ? t('uploadsScreen.opening')
                : t('uploadsScreen.addRecitation')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ListHeaderComponent = () => {
    return (
      <View style={styles.headerContainer}>
        <View
          style={[
            styles.contentArea,
            {
              paddingTop: USE_GLASS
                ? moderateScale(16)
                : insets.top + moderateScale(40),
            },
          ]}>
          {/* Hero Icon */}
          <View style={styles.contentCenter}>
            <View style={styles.heroIconContainer}>
              <View style={styles.heroIconInner}>
                <MicrophoneIcon
                  color={theme.colors.text}
                  size={moderateScale(30)}
                />
              </View>
            </View>
            <Text style={styles.title}>{t('common:terms.uploads')}</Text>
            <Text style={styles.subtitle}>
              {t('uploadsScreen.recitationsCount', {count: totalCount})}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={[styles.actionButtons, forceLTR]}>
          {!USE_GLASS && (
            <Pressable
              style={[
                styles.circleButton,
                !hasRecitations && styles.disabledButton,
              ]}
              onPress={hasRecitations ? handleOptionsMenu : undefined}
              disabled={!hasRecitations}>
              <Feather
                name="more-horizontal"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
              {hasRecitations && (
                <CollectionOptionsMenu
                  payload={optionsPayload}
                  layout="overlay"
                />
              )}
            </Pressable>
          )}
          <Pressable
            style={[
              styles.circleButton,
              styles.playButton,
              !hasRecitations && styles.disabledButton,
            ]}
            onPress={hasRecitations ? handlePlayAll : undefined}
            disabled={!hasRecitations}>
            <View style={styles.playIconContainer}>
              <PlayIcon
                color={theme.colors.background}
                size={moderateScale(16)}
              />
            </View>
          </Pressable>
          <Pressable
            style={[
              styles.circleButton,
              !hasRecitations && styles.disabledButton,
            ]}
            onPress={hasRecitations ? handleShuffle : undefined}
            disabled={!hasRecitations}>
            <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
          </Pressable>
        </View>

        {/* Add Recitation Bar */}
        <Pressable
          style={styles.uploadBar}
          onPress={handleImportFile}
          disabled={isImporting}>
          {isImporting ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.textSecondary}
            />
          ) : (
            <Feather
              name="plus"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
          )}
          <Text style={styles.uploadBarText}>
            {isImporting
              ? t('uploadsScreen.opening')
              : t('uploadsScreen.addRecitation')}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!USE_GLASS && (
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
        data={recitations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
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
      backgroundColor: theme.colors.background,
    },
    itemPlayZone: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingLeft: moderateScale(18),
    },
    itemIconContainer: {
      width: moderateScale(44),
      height: moderateScale(44),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(10),
    },
    itemReciterImage: {
      width: moderateScale(44),
      height: moderateScale(44),
      borderRadius: moderateScale(10),
      marginRight: moderateScale(10),
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
