/**
 * AdhkarAudioControls Component
 *
 * Audio playback controls for dhikr reading screen.
 * Two-row layout: progress bar on top (fixed height), buttons below.
 * Play/pause, repeat toggle, and action buttons (copy, bookmark, share, settings).
 */

import React, {useMemo, useState, useCallback} from 'react';
import {View, TouchableOpacity} from 'react-native';
import {Feather, Ionicons} from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {useAdhkarProgress} from '@/hooks/useAdhkarProgress';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {useAdhkarSessionSource} from './AdhkarSessionSourceContext';
import {Theme} from '@/utils/themeUtils';
import {PlayIcon, PauseIcon, RepeatIcon} from '@/components/Icons';
import Color from 'color';
// @ai-start
import {useTranslation} from 'react-i18next';
import {forceLTR} from '@/utils/rtl';
import {hasAudio} from '@/utils/adhkarAudio';
// @ai-end

const PROGRESS_BAR_HEIGHT = moderateScale(40);
const PROGRESS_BAR_MARGIN = moderateScale(8);

interface AdhkarAudioControlsProps {
  dhikrId: string;
  audioFile: string | null;
  onCopy: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onSettings: () => void;
  isBookmarked: boolean;
}

// @ai-start
export const AdhkarAudioControls: React.FC<AdhkarAudioControlsProps> =
  React.memo(
    ({
      dhikrId,
      audioFile,
      onCopy,
      onBookmark,
      onShare,
      onSettings,
      isBookmarked,
    }) => {
      const {theme} = useTheme();
      const {t} = useTranslation('player');
      const styles = useMemo(() => createStyles(theme), [theme]);

      const source = useAdhkarSessionSource();
      const dispatch = useAdhkarSessionStore(s => s.dispatch);
      const index = source?.items.findIndex(i => i.dhikrId === dhikrId) ?? -1;
      const isCurrent = useAdhkarSessionStore(
        s =>
          !!s.session &&
          !!source &&
          s.session.listId === source.listId &&
          s.session.items[s.session.index]?.dhikrId === dhikrId,
      );
      const status = useAdhkarSessionStore(s =>
        isCurrent ? s.session?.status : undefined,
      );
      const isLooping = useAdhkarSessionStore(s =>
        isCurrent ? !!s.session?.loop : false,
      );
      const isSingle = useAdhkarSessionStore(
        s => !isCurrent || s.session?.mode === 'single',
      );
      const isPlaying = status === 'playing' || status === 'loading';
      const {currentTime, duration, seek} = useAdhkarProgress(isCurrent);
      const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

      const handleToggle = () => {
        if (!source || index < 0) return;
        dispatch({type: 'pressCard', source, index});
      };
      const toggleLooping = () => {
        if (isCurrent) dispatch({type: 'toggleLoop'});
      };

      // Seeking state for thumb visibility
      const [isSeeking, setIsSeeking] = useState(false);

      // Active background color for repeat button
      const activeBackgroundColor = `${theme.colors.text}20`;

      // Handle slider interactions
      const handleSliderStart = useCallback(() => {
        setIsSeeking(true);
      }, []);

      const handleSlidingComplete = useCallback(
        (value: number) => {
          seek(value);
          setIsSeeking(false);
        },
        [seek],
      );

      // No audio available - show placeholder and action buttons
      if (!hasAudio(audioFile)) {
        return (
          <View style={styles.container}>
            <View style={styles.buttonsRow}>
              <View style={styles.noAudioPlaceholder}>
                <Feather
                  name="volume-x"
                  size={moderateScale(18)}
                  color={theme.colors.textSecondary}
                />
              </View>
              {/* Repeat button (disabled state) */}
              <TouchableOpacity
                style={styles.repeatButton}
                disabled
                activeOpacity={1}>
                <RepeatIcon
                  size={moderateScale(20)}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
              {/* Action buttons */}
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onCopy}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  accessibilityRole="button"
                  accessibilityLabel={t('adhkar.a11y.copyArabic')}>
                  <Feather
                    name="copy"
                    size={moderateScale(18)}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onBookmark}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isBookmarked
                      ? t('adhkar.a11y.removeBookmark')
                      : t('adhkar.a11y.addBookmark')
                  }
                  accessibilityState={{selected: isBookmarked}}>
                  <Ionicons
                    name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={moderateScale(18)}
                    color={
                      isBookmarked
                        ? theme.colors.text
                        : theme.colors.textSecondary
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onShare}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  accessibilityRole="button"
                  accessibilityLabel={t('adhkar.a11y.shareDhikr')}>
                  <Feather
                    name="share"
                    size={moderateScale(18)}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onSettings}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  accessibilityRole="button"
                  accessibilityLabel={t('adhkar.a11y.layoutSettings')}>
                  <Feather
                    name="sliders"
                    size={moderateScale(18)}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.container}>
          {/* Progress Bar Row (fixed height, so cards never jump) */}
          <View
            testID="adhkar-progress-row"
            style={[styles.progressRow, forceLTR]}>
            <Slider
              style={styles.slider}
              value={isCurrent ? progress : 0}
              disabled={!isCurrent}
              onSlidingStart={handleSliderStart}
              onSlidingComplete={handleSlidingComplete}
              minimumValue={0}
              maximumValue={1}
              tapToSeek
              minimumTrackTintColor={theme.colors.text}
              maximumTrackTintColor={`${theme.colors.text}4D`}
              thumbTintColor={isSeeking ? theme.colors.text : 'transparent'}
            />
          </View>

          {/* Buttons Row */}
          <View style={styles.buttonsRow}>
            {/* Play/Pause Button */}
            <TouchableOpacity
              testID="adhkar-play-button"
              style={styles.playButton}
              onPress={handleToggle}
              activeOpacity={1}
              accessibilityRole="button"
              accessibilityLabel={
                isPlaying
                  ? t('adhkar.a11y.pauseAudio')
                  : t('adhkar.a11y.playAudio')
              }>
              {isPlaying ? (
                <PauseIcon
                  size={moderateScale(14)}
                  color={theme.colors.background}
                />
              ) : (
                <PlayIcon
                  size={moderateScale(14)}
                  color={theme.colors.background}
                />
              )}
            </TouchableOpacity>

            {/* Repeat Toggle Button (single-dhikr playback only) */}
            {isSingle && (
              <TouchableOpacity
                style={[
                  styles.repeatButton,
                  isLooping && {backgroundColor: activeBackgroundColor},
                ]}
                onPress={toggleLooping}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  isLooping
                    ? t('adhkar.a11y.disableRepeat')
                    : t('adhkar.a11y.enableRepeat')
                }
                accessibilityState={{selected: isLooping}}>
                <RepeatIcon
                  size={moderateScale(20)}
                  color={
                    isLooping ? theme.colors.text : theme.colors.textSecondary
                  }
                />
              </TouchableOpacity>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onCopy}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel={t('adhkar.a11y.copyArabic')}>
                <Feather
                  name="copy"
                  size={moderateScale(18)}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={onBookmark}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel={
                  isBookmarked
                    ? t('adhkar.a11y.removeBookmark')
                    : t('adhkar.a11y.addBookmark')
                }
                accessibilityState={{selected: isBookmarked}}>
                <Ionicons
                  name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={moderateScale(18)}
                  color={
                    isBookmarked
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={onShare}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel={t('adhkar.a11y.shareDhikr')}>
                <Feather
                  name="share"
                  size={moderateScale(18)}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={onSettings}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel={t('adhkar.a11y.layoutSettings')}>
                <Feather
                  name="sliders"
                  size={moderateScale(18)}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
  );
// @ai-end

AdhkarAudioControls.displayName = 'AdhkarAudioControls';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'column',
      alignItems: 'center',
    },
    progressRow: {
      width: '100%',
      height: PROGRESS_BAR_HEIGHT,
      marginBottom: PROGRESS_BAR_MARGIN,
      paddingHorizontal: moderateScale(16),
      overflow: 'hidden',
    },
    slider: {
      width: '100%',
      height: '100%',
    },
    buttonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(4),
    },
    playButton: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(10),
      backgroundColor: theme.colors.text,
      justifyContent: 'center',
      alignItems: 'center',
      paddingLeft: moderateScale(2), // Visual centering for play icon
    },
    repeatButton: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(10),
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButtonsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    actionButton: {
      width: moderateScale(36),
      height: moderateScale(36),
      justifyContent: 'center',
      alignItems: 'center',
    },
    noAudioPlaceholder: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
