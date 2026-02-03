/**
 * AdhkarAudioControls Component
 *
 * Audio playback controls for dhikr reading screen.
 * Displays play/pause button with animated progress bar and action buttons.
 */

import React, {useMemo} from 'react';
import {View, TouchableOpacity} from 'react-native';
import {Icon} from '@rneui/themed';
import Slider from '@react-native-community/slider';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import Animated, {useAnimatedStyle, withSpring} from 'react-native-reanimated';
import {useTheme} from '@/hooks/useTheme';
import {useAdhkarAudio} from '@/hooks/useAdhkarAudio';
import {Theme} from '@/utils/themeUtils';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import Color from 'color';

// Pre-compute scaled values outside component to avoid worklet issues
const PROGRESS_BAR_WIDTH = moderateScale(120);
const PROGRESS_BAR_MARGIN = moderateScale(12);

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

      const {isPlaying, progress, toggle, seekToProgress} =
        useAdhkarAudio(audioFile);

      // Animated style for progress bar expansion
      const progressBarAnimatedStyle = useAnimatedStyle(() => {
        const showProgress = isPlaying || progress > 0;
        return {
          width: withSpring(showProgress ? PROGRESS_BAR_WIDTH : 0, {
            damping: 15,
            stiffness: 150,
          }),
          opacity: withSpring(showProgress ? 1 : 0, {
            damping: 20,
            stiffness: 200,
          }),
          marginHorizontal: withSpring(showProgress ? PROGRESS_BAR_MARGIN : 0, {
            damping: 15,
            stiffness: 150,
          }),
        };
      }, [isPlaying, progress]);

      // Handle slider value change
      const handleSliderChange = (value: number) => {
        seekToProgress(value);
      };

      // Render action buttons (copy, bookmark, share)
      const renderActionButtons = () => (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onCopy}
            activeOpacity={1}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel="Copy Arabic text">
            <Icon
              name="copy"
              type="feather"
              size={moderateScale(18)}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onBookmark}
            activeOpacity={1}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel={
              isBookmarked ? 'Remove bookmark' : 'Add bookmark'
            }
            accessibilityState={{selected: isBookmarked}}>
            <Icon
              name="bookmark"
              type="feather"
              size={moderateScale(18)}
              color={
                isBookmarked ? theme.colors.primary : theme.colors.textSecondary
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onShare}
            activeOpacity={1}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel="Share dhikr">
            <Icon
              name="share"
              type="feather"
              size={moderateScale(18)}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onSettings}
            activeOpacity={1}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel="Layout settings">
            <Icon
              name="sliders"
              type="feather"
              size={moderateScale(18)}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      );

      // No audio available - show placeholder and action buttons
      if (!audioFile) {
        return (
          <View style={styles.container}>
            <View style={styles.noAudioPlaceholder}>
              <Icon
                name="volume-x"
                type="feather"
                size={moderateScale(18)}
                color={theme.colors.textSecondary}
              />
            </View>
            {renderActionButtons()}
          </View>
        );
      }

      return (
        <View style={styles.container}>
          {/* Play/Pause Button - styled like reciter detail screen */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={toggle}
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

          {/* Animated Progress Slider */}
          <Animated.View
            style={[styles.sliderContainer, progressBarAnimatedStyle]}>
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

          {/* Action Buttons */}
          {renderActionButtons()}
        </View>
      );
    },
  );

AdhkarAudioControls.displayName = 'AdhkarAudioControls';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
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
    sliderContainer: {
      overflow: 'hidden',
    },
    slider: {
      width: '100%',
      height: moderateScale(32),
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
