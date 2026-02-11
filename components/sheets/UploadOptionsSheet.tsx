import React, {useCallback, useState, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {QueueIcon, HeartIcon, PlayIcon, ProfileIcon} from '@/components/Icons';
import ActionSheet, {
  SheetProps,
  SheetManager,
  ScrollView,
} from 'react-native-actions-sheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useUploadsStore, getCustomReciterName} from '@/store/uploadsStore';
import {getSurahById, getReciterName} from '@/services/dataService';
import {useLoved} from '@/hooks/useLoved';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import type {UploadedRecitation} from '@/types/uploads';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';

const surahInfo = require('@/data/surahInfo.json');

const SCREEN_HEIGHT = Dimensions.get('window').height;

const renderHtmlDefaultProps: Partial<RenderHTMLProps> = {
  enableExperimentalMarginCollapsing: true,
  enableExperimentalGhostLinesPrevention: true,
  enableExperimentalBRCollapsing: true,
  allowedStyles: [],
  enableCSSInlineProcessing: true,
  systemFonts: [
    ...defaultSystemFonts,
    'Manrope-Regular',
    'Manrope-Medium',
    'Manrope-Bold',
  ],
  baseStyle: {
    color: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'Manrope-Regular',
  },
};

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
  } else if (item.type === 'other' && item.category) {
    const label =
      item.category.charAt(0).toUpperCase() + item.category.slice(1);
    parts.push(label);
  }

  if (item.startVerse != null) {
    if (item.endVerse != null) {
      parts.push(`Verses ${item.startVerse}-${item.endVerse}`);
    } else {
      parts.push(`Verse ${item.startVerse}`);
    }
  }

  if (item.recordingType === 'salah') {
    parts.push('Salah');
  } else if (item.recordingType === 'studio') {
    parts.push('Studio');
  }

  if (item.duration !== null) {
    const mins = Math.floor(item.duration / 60);
    const secs = Math.floor(item.duration % 60);
    parts.push(`${mins}:${secs.toString().padStart(2, '0')}`);
  }

  return parts.join(' \u00B7 ');
}

export const UploadOptionsSheet = (props: SheetProps<'upload-options'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {width} = useWindowDimensions();
  const [showSurahInfo, setShowSurahInfo] = useState(false);

  const {deleteRecitation} = useUploadsStore();
  const {isLovedWithRewayat, toggleLoved} = useLoved();
  const {navigateToReciterProfile} = useReciterNavigation();

  const payload = props.payload;
  const recitation = payload?.recitation;
  const reciterId = payload?.reciterId;
  const onPlay = payload?.onPlay;
  const onAddToQueue = payload?.onAddToQueue;

  const surahNumber = recitation?.surahNumber;
  const surah = surahNumber ? getSurahById(surahNumber) : null;
  const surahId = surah?.id?.toString() ?? '';
  const currentSurahInfo = surah ? surahInfo[surah.id] : null;
  const isSurahType = recitation?.type === 'surah' && !!surah;
  const hasSurah = !!surah;
  const hasReciter = !!reciterId;

  const isLovedState =
    hasSurah && hasReciter
      ? isLovedWithRewayat(reciterId!, surahId, '')
      : false;

  const tagsStyles = useMemo(
    () => ({
      div: {
        color: theme.colors.text,
        fontSize: moderateScale(16),
        fontFamily: 'Manrope-Regular',
        lineHeight: moderateScale(24),
      } as MixedStyleDeclaration,
      p: {
        marginBottom: moderateScale(16),
      } as MixedStyleDeclaration,
      a: {
        color: theme.colors.primary,
        textDecorationLine: 'underline',
      } as MixedStyleDeclaration,
      li: {
        marginBottom: moderateScale(8),
      } as MixedStyleDeclaration,
      ul: {
        marginBottom: moderateScale(16),
        paddingLeft: moderateScale(16),
      } as MixedStyleDeclaration,
      ol: {
        marginBottom: moderateScale(16),
        paddingLeft: moderateScale(16),
      } as MixedStyleDeclaration,
    }),
    [theme.colors.text, theme.colors.primary],
  );

  const handleClose = useCallback(() => {
    SheetManager.hide('upload-options');
  }, []);

  const handlePlay = useCallback(() => {
    handleClose();
    onPlay?.();
  }, [onPlay, handleClose]);

  const handleOrganize = useCallback(() => {
    if (!recitation) return;
    handleClose();
    setTimeout(() => {
      SheetManager.show('organize-recitation', {
        payload: {recitation, prefillReciterId: reciterId},
      });
    }, 300);
  }, [recitation, reciterId, handleClose]);

  const handleAddToQueue = useCallback(() => {
    handleClose();
    onAddToQueue?.();
  }, [onAddToQueue, handleClose]);

  const handleToggleLove = useCallback(() => {
    if (!reciterId || !surahId) return;
    toggleLoved(reciterId, surahId, '', recitation?.id);
  }, [reciterId, surahId, toggleLoved, recitation?.id]);

  const handleAddToPlaylist = useCallback(() => {
    if (!reciterId || !surah) return;
    SheetManager.show('select-playlist', {
      payload: {
        surah,
        reciterId,
        rewayatId: undefined,
        userRecitationId: recitation?.id,
      },
    });
  }, [reciterId, surah, recitation?.id]);

  const handleGoToReciter = useCallback(() => {
    handleClose();
    if (reciterId) {
      navigateToReciterProfile(reciterId);
    }
  }, [handleClose, reciterId, navigateToReciterProfile]);

  const handleViewInfo = useCallback(() => {
    setShowSurahInfo(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!recitation) return;
    const title = getDisplayTitle(recitation);
    Alert.alert(
      'Delete Recitation',
      `Are you sure you want to delete "${title}"?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            handleClose();
            deleteRecitation(recitation.id);
          },
        },
      ],
    );
  }, [recitation, handleClose, deleteRecitation]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowSurahInfo(false);
    }
  }, []);

  if (!recitation) {
    return null;
  }

  const title = getDisplayTitle(recitation);
  const subtitle = getDisplaySubtitle(recitation);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={[
        styles.sheetContainer,
        showSurahInfo && styles.sheetContainerExpanded,
      ]}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onChange={handleSheetChange}>
      {showSurahInfo ? (
        <>
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>About {surah?.name}</Text>
          </View>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={true}>
            <View style={styles.infoContent}>
              <View style={styles.surahInfoHeader}>
                <Text style={styles.surahInfoName}>{surah?.name}</Text>
                <Text style={styles.surahInfoTranslation}>
                  {surah?.translated_name_english}
                </Text>
              </View>
              {currentSurahInfo && (
                <RenderHtml
                  {...renderHtmlDefaultProps}
                  contentWidth={width - moderateScale(72)}
                  source={{html: `<div>${currentSurahInfo.text}</div>`}}
                  tagsStyles={tagsStyles}
                />
              )}
            </View>
          </ScrollView>
        </>
      ) : (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.optionsGrid}>
            <Pressable
              style={({pressed}) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              onPress={handlePlay}>
              <PlayIcon color={theme.colors.text} size={moderateScale(20)} />
              <Text style={styles.optionText}>Play Now</Text>
            </Pressable>

            <Pressable
              style={({pressed}) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              onPress={handleOrganize}>
              <Feather
                name="sliders"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
              <Text style={styles.optionText}>Edit Details</Text>
            </Pressable>

            <Pressable
              style={({pressed}) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              onPress={handleAddToQueue}>
              <View style={styles.rotatedIcon}>
                <QueueIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                  filled={true}
                />
              </View>
              <Text style={styles.optionText}>Add to Queue</Text>
            </Pressable>

            {hasSurah && hasReciter && (
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleToggleLove}>
                <HeartIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                  filled={isLovedState}
                />
                <Text style={styles.optionText}>
                  {isLovedState ? 'Remove from Loved' : 'Add to Loved'}
                </Text>
              </Pressable>
            )}

            {hasSurah && hasReciter && (
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleAddToPlaylist}>
                <Feather
                  name="plus-circle"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>Add to Collection</Text>
              </Pressable>
            )}

            {hasReciter && (
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleGoToReciter}>
                <ProfileIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                  filled={false}
                />
                <Text style={styles.optionText}>Go to Reciter</Text>
              </Pressable>
            )}

            {hasSurah && (
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleViewInfo}>
                <Feather
                  name="info"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>Learn About Surah</Text>
              </Pressable>
            )}

            <Pressable
              style={({pressed}) => [
                styles.optionDestructive,
                pressed && styles.optionDestructivePressed,
              ]}
              onPress={handleDelete}>
              <Feather
                name="trash-2"
                size={moderateScale(20)}
                color="#ff4444"
              />
              <Text style={styles.optionTextDestructive}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
    },
    sheetContainerExpanded: {
      height: SCREEN_HEIGHT * 0.85,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(8),
      marginBottom: moderateScale(20),
      gap: moderateScale(4),
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    optionsGrid: {
      gap: moderateScale(8),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    optionDestructive: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
      borderRadius: moderateScale(12),
    },
    optionDestructivePressed: {
      backgroundColor: 'rgba(255, 68, 68, 0.18)',
    },
    optionTextDestructive: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: '#ff4444',
      marginLeft: moderateScale(12),
    },
    rotatedIcon: {
      transform: [{rotate: '180deg'}],
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    scrollView: {
      flex: 1,
    },
    infoContent: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    surahInfoHeader: {
      alignItems: 'center',
      marginVertical: moderateScale(16),
      gap: moderateScale(4),
    },
    surahInfoName: {
      fontSize: moderateScale(24),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    surahInfoTranslation: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: moderateScale(16),
    },
  });
