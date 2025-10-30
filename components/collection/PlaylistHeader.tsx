import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {Icon} from '@rneui/themed';
import {useSafeAreaInsets, EdgeInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Theme} from '@/utils/themeUtils';
import {CollectionActionButtons} from '@/components/CollectionActionButtons';

interface PlaylistHeaderProps {
  title: string;
  subtitle: string;
  backgroundColor: string;
  iconName: string;
  iconType?: string;
  onPlayPress: () => void;
  onShufflePress: () => void;
  onDownloadPress?: () => void;
  showDownloadIcon?: boolean;
  downloadDisabled?: boolean;
  theme: Theme;
}

export const PlaylistHeader: React.FC<PlaylistHeaderProps> = ({
  title,
  subtitle,
  backgroundColor,
  iconName,
  iconType = 'feather',
  onPlayPress,
  onShufflePress,
  onDownloadPress,
  showDownloadIcon = false,
  downloadDisabled = false,
  theme,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = createStyles(theme, insets);

  return (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={[backgroundColor, theme.colors.background]}
        style={styles.gradientContainer}>
        
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color="white"
          />
        </TouchableOpacity>

        {/* Header Content */}
        <View style={styles.contentContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Icon
              name={iconName}
              type={iconType}
              size={moderateScale(80)}
              color="white"
            />
          </View>

          {/* Title and Subtitle */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Action Buttons */}
        
        </View>
      </LinearGradient>
      <View style={showDownloadIcon? styles.actionButtons : styles.actionButtonsWithoutDownload}>
          <CollectionActionButtons
            onPlayPress={onPlayPress}
            onShufflePress={onShufflePress}
            onDownloadPress={onDownloadPress}
            showDownloadIcon={showDownloadIcon}
            disabled={downloadDisabled}
          />
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
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(20),
    },
    actionButtonsWithoutDownload: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(20),
    },
    gradientContainer: {
      width: '100%',
      alignItems: 'center',
      paddingTop: insets.top + moderateScale(30),
      paddingBottom: moderateScale(40),
      overflow: 'hidden',
    },
    backButton: {
      position: 'absolute',
      top: insets.top + moderateScale(20),
      left: moderateScale(20),
      zIndex: 10,
      padding: moderateScale(8),
    },
    contentContainer: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(20),
    },
    iconContainer: {
      width: moderateScale(100),
      height: moderateScale(100),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: moderateScale(16),
    },
    title: {
      fontSize: moderateScale(28),
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      marginBottom: moderateScale(8),
    },
    subtitle: {
      fontSize: moderateScale(16),
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
      marginBottom: moderateScale(20),
    },
  });
