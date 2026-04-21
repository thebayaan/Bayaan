import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {useSafeAreaInsets, EdgeInsets} from 'react-native-safe-area-context';
import {Theme} from '@/utils/themeUtils';
import {PlayIcon, ShuffleIcon, HeartIcon} from '@/components/Icons';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {USE_GLASS} from '@/hooks/useGlassProps';

interface LovedHeaderProps {
  title: string;
  subtitle: string;
  onPlayPress: () => void;
  onShufflePress: () => void;
  onOptionsPress?: () => void;
  theme: Theme;
}

export const LovedHeader: React.FC<LovedHeaderProps> = ({
  title,
  subtitle,
  onPlayPress,
  onShufflePress,
  onOptionsPress,
  theme,
}) => {
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.contentArea}>
        {/* Header Content */}
        <View style={styles.contentContainer}>
          {/* Hero Icon Container */}
          <View style={styles.heroIconContainer}>
            <View style={styles.heroIconInner}>
              <View style={{marginTop: moderateScale(6)}}>
                <HeartIcon
                  color={theme.colors.text}
                  size={moderateScale(30)}
                  filled={true}
                />
              </View>
            </View>
          </View>

          {/* Title and Subtitle */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {!USE_GLASS && onOptionsPress && (
          <Pressable style={styles.circleButton} onPress={onOptionsPress}>
            <Feather
              name="more-horizontal"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Pressable>
        )}
        <Pressable
          style={[styles.circleButton, styles.playButton]}
          onPress={onPlayPress}>
          <View style={styles.playIconContainer}>
            <PlayIcon
              color={theme.colors.background}
              size={moderateScale(16)}
            />
          </View>
        </Pressable>
        <Pressable style={styles.circleButton} onPress={onShufflePress}>
          <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
        </Pressable>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme, insets: EdgeInsets) =>
  ScaledSheet.create({
    headerContainer: {
      width: '100%',
      overflow: 'hidden',
    },
    contentArea: {
      width: '100%',
      alignItems: 'center',
      paddingTop: USE_GLASS
        ? moderateScale(16)
        : insets.top + moderateScale(40),
      paddingBottom: moderateScale(10),
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
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
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(8),
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: moderateScale(12),
      color: theme.colors.text,
      fontFamily: theme.fonts.regular,
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
  });
