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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {MicrophoneIcon, PlayIcon, ShuffleIcon} from '@/components/Icons';
import {SheetManager} from 'react-native-actions-sheet';
import {useUploadsStore, getCustomReciterName} from '@/store/uploadsStore';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createUserUploadTrack} from '@/utils/track';
import {getSurahById, getReciterName} from '@/services/dataService';
import {shuffleArray} from '@/utils/arrayUtils';
import Color from 'color';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type {UploadedRecitation, RecordingType} from '@/types/uploads';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {pickAndImportAudioFiles} from '@/utils/importAudio';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {GradientText} from '@/components/GradientText';
import {ReciterImage} from '@/components/ReciterImage';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

function getDisplayTitle(item: UploadedRecitation): string {
  if (item.type === 'surah' && item.surahNumber) {
    const surah = getSurahById(item.surahNumber);
    if (surah) return surah.name;
  }
  if (item.type === 'other' && item.title) {
    return item.title;
  }
  return stripExtension(item.originalFilename);
}

function getDisplaySubtitle(item: UploadedRecitation): string {
  const parts: string[] = [];

  if (item.reciterId) {
    const name = getReciterName(item.reciterId);
    if (name) parts.push(name);
  } else if (item.customReciterId) {
    const name = getCustomReciterName(item.customReciterId);
    if (name) parts.push(name);
  }

  if (item.type === null) {
    parts.push('Untagged');
  }

  return parts.length > 0
    ? parts.join(' \u00B7 ')
    : stripExtension(item.originalFilename);
}

function getVerseRangeLabel(item: UploadedRecitation): string | null {
  if (item.startVerse == null) return null;
  if (item.endVerse != null) return `${item.startVerse}-${item.endVerse}`;
  return `v${item.startVerse}`;
}

function getRecordingTypeLabel(recordingType: RecordingType): string | null {
  if (recordingType === 'salah') return 'Salah';
  if (recordingType === 'studio') return 'Studio';
  return null;
}

interface UploadListItemProps {
  item: UploadedRecitation;
  index: number;
  onPlay: (item: UploadedRecitation, index: number) => void;
  onShowOptions: (item: UploadedRecitation, index: number) => void;
}

const UploadListItem: React.FC<UploadListItemProps> = React.memo(
  ({item, index, onPlay, onShowOptions}) => {
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
        if (surah) return `${item.surahNumber}. ${surah.name}`;
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
                    {item.category.charAt(0).toUpperCase() +
                      item.category.slice(1)}
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
                {item.style
                  ? ` \u00B7 ${
                      item.style.charAt(0).toUpperCase() + item.style.slice(1)
                    }`
                  : ''}
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
        </Pressable>
      </View>
    );
  },
);

UploadListItem.displayName = 'UploadListItem';

export default function UploadsScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {recitations, totalCount, importFile, importFiles, loadRecitations} =
    useUploadsStore();
  const {updateQueue, addToQueue, play} = usePlayerActions();

  const [isImporting, setIsImporting] = useState(false);

  // Scroll tracking for sticky header
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    loadRecitations();
  }, [loadRecitations]);

  // Animated button scales
  const shuffleScale = useSharedValue(1);
  const playScale = useSharedValue(1);

  const shuffleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: shuffleScale.value}],
  }));
  const playAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: playScale.value}],
  }));

  const handlePressIn = useCallback(
    (button: 'shuffle' | 'play') => {
      const scale = button === 'shuffle' ? shuffleScale : playScale;
      scale.value = withSpring(0.92, {damping: 15, stiffness: 300});
    },
    [shuffleScale, playScale],
  );

  const handlePressOut = useCallback(
    (button: 'shuffle' | 'play') => {
      const scale = button === 'shuffle' ? shuffleScale : playScale;
      scale.value = withSpring(1, {damping: 15, stiffness: 300});
    },
    [shuffleScale, playScale],
  );

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
      } catch (error) {
        console.error('Error playing uploaded recitation:', error);
      }
    },
    [recitations, updateQueue, play],
  );

  const handleShowOptions = useCallback(
    (item: UploadedRecitation, index: number) => {
      const track = createUserUploadTrack(item);
      SheetManager.show('upload-options', {
        payload: {
          recitation: item,
          reciterId: item.reciterId || '',
          onPlay: () => handlePlayRecitation(item, index),
          onAddToQueue: () => {
            addToQueue([track]);
          },
        },
      });
    },
    [handlePlayRecitation, addToQueue],
  );

  const styles = useMemo(() => createStyles(theme), [theme]);
  const hasRecitations = recitations.length > 0;

  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<UploadedRecitation>) => (
      <UploadListItem
        item={item}
        index={index}
        onPlay={handlePlayRecitation}
        onShowOptions={handleShowOptions}
      />
    ),
    [handlePlayRecitation, handleShowOptions],
  );

  const keyExtractor = useCallback((item: UploadedRecitation) => item.id, []);

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View
          style={[
            styles.contentArea,
            {paddingTop: insets.top + moderateScale(40)},
          ]}>
          {/* Back Button */}
          <Pressable
            style={[styles.backButton, {top: insets.top + moderateScale(10)}]}
            onPress={() => router.back()}
            hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </Pressable>

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
            <Text style={styles.title}>Uploads</Text>
            <Text style={styles.subtitle}>
              {totalCount} recitation{totalCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.contentWrapper}>
          <View style={styles.actionButtons}>
            <View />
            {/* Right side buttons */}
            <View style={styles.rightAlignedButtons}>
              <AnimatedPressable
                style={[
                  styles.circleButton,
                  shuffleAnimatedStyle,
                  !hasRecitations && styles.disabledButton,
                ]}
                onPress={hasRecitations ? handleShuffle : undefined}
                onPressIn={
                  hasRecitations ? () => handlePressIn('shuffle') : undefined
                }
                onPressOut={
                  hasRecitations ? () => handlePressOut('shuffle') : undefined
                }
                disabled={!hasRecitations}>
                <ShuffleIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                />
              </AnimatedPressable>
              <AnimatedPressable
                style={[
                  styles.circleButton,
                  styles.playButton,
                  playAnimatedStyle,
                  !hasRecitations && styles.disabledButton,
                ]}
                onPress={hasRecitations ? handlePlayAll : undefined}
                onPressIn={
                  hasRecitations ? () => handlePressIn('play') : undefined
                }
                onPressOut={
                  hasRecitations ? () => handlePressOut('play') : undefined
                }
                disabled={!hasRecitations}>
                <View style={styles.playIconContainer}>
                  <PlayIcon
                    color={theme.colors.background}
                    size={moderateScale(16)}
                  />
                </View>
              </AnimatedPressable>
            </View>
          </View>
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
            {isImporting ? 'Opening...' : 'Add Recitation'}
          </Text>
        </Pressable>
      </View>
    );
  }, [
    styles,
    theme,
    insets.top,
    totalCount,
    router,
    handleImportFile,
    isImporting,
    hasRecitations,
    handlePlayAll,
    handleShuffle,
    handlePressIn,
    handlePressOut,
    shuffleAnimatedStyle,
    playAnimatedStyle,
  ]);

  const ListEmptyComponent = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No uploads yet. Tap + to add recitations.
        </Text>
      </View>
    );
  }, [styles]);

  return (
    <View style={styles.container}>
      <RNAnimated.FlatList
        data={recitations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
      />
      <CollectionStickyHeader title="Uploads" scrollY={scrollY} />
    </View>
  );
}

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
      paddingBottom: moderateScale(30),
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    backButton: {
      position: 'absolute',
      left: moderateScale(15),
      zIndex: 10,
      padding: moderateScale(8),
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
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: moderateScale(12),
      color: theme.colors.text,
      fontFamily: theme.fonts?.regular || 'Manrope-Regular',
      textAlign: 'center',
      marginBottom: moderateScale(8),
    },
    contentWrapper: {
      paddingHorizontal: moderateScale(16),
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(5),
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
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
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
      paddingBottom: moderateScale(65),
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: moderateScale(60),
      paddingHorizontal: moderateScale(32),
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: moderateScale(24),
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
      paddingLeft: moderateScale(12),
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
