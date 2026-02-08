/**
 * AdhkarAudioControls Component
 *
 * Audio playback controls for dhikr reading screen.
 * Two-row layout: progress bar on top (when playing), buttons below.
 * Play/pause, repeat toggle, and action buttons (copy, bookmark, share, settings).
 */

import React, {useMemo} from 'react';
import {View, TouchableOpacity} from 'react-native';
import {Feather, Ionicons} from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import Animated, {useAnimatedStyle, withSpring} from 'react-native-reanimated';
import {useTheme} from '@/hooks/useTheme';
import {useAdhkarAudio} from '@/hooks/useAdhkarAudio';
import {useAdhkarAudioStore} from '@/store/adhkarAudioStore';
import {useAdhkarPlayAllStore} from '@/store/adhkarPlayAllStore';
import {Theme} from '@/utils/themeUtils';
import {PlayIcon, PauseIcon, RepeatIcon} from '@/components/Icons';
import Color from 'color';

// Pre-compute scaled values outside component to avoid worklet issues
const PROGRESS_BAR_HEIGHT = moderateScale(40);
const PROGRESS_BAR_MARGIN = moderateScale(8);

interface AdhkarAudioControlsProps {
  audioFile: string | null;
  onCopy: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onSettings: () => void;
  isBookmarked: boolean;
}

export const AdhkarAudioControls: React.FC<AdhkarAudioControlsProps> =
  React.memo(
    ({audioFile, onCopy, onBookmark, onShare, onSettings, isBookmarked}) => {
      const {theme} = useTheme();
      const styles = useMemo(() => createStyles(theme), [theme]);

      const {
        isPlaying: singleIsPlaying,
        isLooping,
        hasInteracted: singleHasInteracted,
        progress,
        duration,
        toggle: singleToggle,
        toggleLooping,
        seekToProgress,
      } = useAdhkarAudio(audioFile);

      // Get setAudio directly from store as fallback
      const setAudio = useAdhkarAudioStore(state => state.setAudio);
      const currentAudioFile = useAdhkarAudioStore(
        state => state.currentAudioFile,
      );

      // Play All store
      const isPlayAllMode = useAdhkarPlayAllStore(state => state.isPlayAllMode);
      const playAllIsPlaying = useAdhkarPlayAllStore(state => state.isPlaying);
      const playAllToggle = useAdhkarPlayAllStore(state => state.toggle);

      // Use Play All state when in Play All mode
      const isPlaying = isPlayAllMode ? playAllIsPlaying : singleIsPlaying;
      const hasInteracted = isPlayAllMode ? true : singleHasInteracted;

      const handleToggle = () => {
        if (isPlayAllMode) {
          // In Play All mode, toggle the Play All store
          playAllToggle();
          return;
        }

        // Single-dhikr mode: If the store doesn't have this audio file set, set it now
        if (audioFile && currentAudioFile !== audioFile) {
          setAudio(audioFile);
        }

        singleToggle();
      };

      // Show progress bar once user has interacted (pressed play) and player is loaded
      const showProgressBar = hasInteracted && duration > 0;

      // Active background color for repeat button
      const activeBackgroundColor = `${theme.colors.text}20`;

      // Animated style for progress bar row (slides down from top)
      const progressRowAnimatedStyle = useAnimatedStyle(() => {
        return {
          height: withSpring(showProgressBar ? PROGRESS_BAR_HEIGHT : 0, {
            damping: 15,
            stiffness: 150,
          }),
          opacity: withSpring(showProgressBar ? 1 : 0, {
            damping: 20,
            stiffness: 200,
          }),
          marginBottom: withSpring(showProgressBar ? PROGRESS_BAR_MARGIN : 0, {
            damping: 15,
            stiffness: 150,
          }),
        };
      }, [showProgressBar]);

      // Handle slider value change
      const handleSliderChange = (value: number) => {
        seekToProgress(value);
      };

      // No audio available - show placeholder and action buttons
      if (!audioFile) {
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
                  accessibilityLabel="Copy Arabic text">
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
                    isBookmarked ? 'Remove bookmark' : 'Add bookmark'
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
                  accessibilityLabel="Share dhikr">
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
                  accessibilityLabel="Layout settings">
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
          {/* Progress Bar Row (animated) */}
          <Animated.View style={[styles.progressRow, progressRowAnimatedStyle]}>
            <Slider
              style={styles.slider}
              value={progress}
              onSlidingComplete={handleSliderChange}
              minimumValue={0}
              maximumValue={1}
              minimumTrackTintColor={theme.colors.text}
              maximumTrackTintColor={Color(theme.colors.textSecondary)
                .alpha(0.3)
                .toString()}
              thumbTintColor={theme.colors.text}
            />
          </Animated.View>

          {/* Buttons Row */}
          <View style={styles.buttonsRow}>
            {/* Play/Pause Button */}
            <TouchableOpacity
              style={styles.playButton}
              onPress={handleToggle}
              activeOpacity={1}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}>
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

            {/* Repeat Toggle Button (always visible) */}
            <TouchableOpacity
              style={[
                styles.repeatButton,
                isLooping && {backgroundColor: activeBackgroundColor},
              ]}
              onPress={toggleLooping}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                isLooping ? 'Disable repeat' : 'Enable repeat'
              }
              accessibilityState={{selected: isLooping}}>
              <RepeatIcon
                size={moderateScale(20)}
                color={
                  isLooping ? theme.colors.text : theme.colors.textSecondary
                }
              />
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onCopy}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel="Copy Arabic text">
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
                  isBookmarked ? 'Remove bookmark' : 'Add bookmark'
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
                accessibilityLabel="Share dhikr">
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
                accessibilityLabel="Layout settings">
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

AdhkarAudioControls.displayName = 'AdhkarAudioControls';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'column',
      alignItems: 'center',
    },
    progressRow: {
      width: '100%',
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
