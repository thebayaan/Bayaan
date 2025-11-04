import React from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {DownloadIcon} from '@/components/Icons';
import Color from 'color';

interface DownloadCardProps {
  itemCount: number;
  onPress: () => void;
  width?: number;
  height?: number;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
  itemCount,
  onPress,
  width,
  height,
}) => {
  const {theme} = useTheme();

  // Green color for downloads
  const downloadColor = '#10AC84';
  const backgroundColor = Color(downloadColor).alpha(0.15).toString();
  const borderColor = Color(downloadColor).alpha(0.3).toString();

  // Use provided dimensions or fall back to default
  const cardWidth = width || moderateScale(120);
  const cardHeight = height || moderateScale(120);
  const iconSize = cardWidth * 0.4; // 40% of card width

  const styles = StyleSheet.create({
    container: {
      width: cardWidth,
    },
    iconContainer: {
      width: cardWidth,
      height: cardHeight,
      marginBottom: verticalScale(5),
      overflow: 'hidden',
      borderRadius: moderateScale(15),
      backgroundColor,
      borderWidth: 1,
      borderColor,
      justifyContent: 'center',
      alignItems: 'center',
    },
    name: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
      marginBottom: verticalScale(2),
    },
    subtitle: {
      fontSize: moderateScale(10),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.container}
      onPress={onPress}>
      <View style={styles.iconContainer}>
        <DownloadIcon color={downloadColor} size={iconSize} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        Downloads
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {itemCount} {itemCount === 1 ? 'surah' : 'surahs'}
      </Text>
    </TouchableOpacity>
  );
};


