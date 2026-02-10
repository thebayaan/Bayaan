import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {useSafeAreaInsets, EdgeInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Theme} from '@/utils/themeUtils';
import {Feather} from '@expo/vector-icons';
import {PlayIcon, ShuffleIcon} from '@/components/Icons';
import {ReciterImage} from '@/components/ReciterImage';
import Color from 'color';

interface ReciterDownloadsHeaderProps {
  reciterId: string;
  reciterName: string;
  reciterImageUrl?: string;
  subtitle: string;
  onPlayPress: () => void;
  onShufflePress: () => void;
  onOptionsPress?: () => void;
  theme: Theme;
}

export const ReciterDownloadsHeader: React.FC<ReciterDownloadsHeaderProps> = ({
  reciterId,
  reciterName,
  reciterImageUrl,
  subtitle,
  onPlayPress,
  onShufflePress,
  onOptionsPress,
  theme,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = createStyles(theme, insets);

  const handleReciterPress = () => {
    router.push(`/reciter/${reciterId}`);
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.contentArea}>
        {/* Back Button */}
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}>
          <Feather
            name="arrow-left"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </Pressable>

        {/* Header Content */}
        <View style={styles.contentContainer}>
          {/* Reciter Image - Tappable to navigate to reciter profile */}
          <Pressable onPress={handleReciterPress}>
            <View style={styles.reciterImageContainer}>
              <ReciterImage
                reciterName={reciterName}
                imageUrl={reciterImageUrl}
                style={styles.reciterImage}
              />
            </View>
          </Pressable>

          {/* Title and Subtitle - Title tappable to navigate to reciter profile */}
          <Pressable onPress={handleReciterPress}>
            <Text style={styles.title}>{reciterName}</Text>
          </Pressable>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Pressable style={styles.circleButton} onPress={onOptionsPress}>
          <Feather
            name="more-horizontal"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
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
      paddingTop: insets.top + moderateScale(40),
      paddingBottom: moderateScale(10),
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    backButton: {
      position: 'absolute',
      top: insets.top + moderateScale(10),
      left: moderateScale(15),
      zIndex: 10,
      padding: moderateScale(8),
    },
    contentContainer: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(20),
    },
    reciterImageContainer: {
      width: moderateScale(80),
      height: moderateScale(80),
      marginBottom: moderateScale(12),
    },
    reciterImage: {
      width: moderateScale(80),
      height: moderateScale(80),
      borderRadius: moderateScale(6),
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
