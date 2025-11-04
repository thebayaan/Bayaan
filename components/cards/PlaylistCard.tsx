import React from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {PlaylistIcon} from '@/components/Icons';
import Color from 'color';

interface PlaylistCardProps {
  name: string;
  itemCount: number;
  color?: string;
  onPress: () => void;
  onLongPress?: () => void;
  width?: number;
  height?: number;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  name,
  itemCount,
  color,
  onPress,
  onLongPress,
  width,
  height,
}) => {
  const {theme} = useTheme();

  const playlistColor = color || theme.colors.primary;
  const backgroundColor = Color(playlistColor).alpha(0.15).toString();
  const borderColor = Color(playlistColor).alpha(0.3).toString();

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
      onPress={onPress}
      onLongPress={onLongPress}>
      <View style={styles.iconContainer}>
        <PlaylistIcon color={playlistColor} size={iconSize} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {itemCount} {itemCount === 1 ? 'surah' : 'surahs'}
      </Text>
    </TouchableOpacity>
  );
};
