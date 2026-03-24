import React, {useMemo} from 'react';
import {Text, Pressable, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {PlaylistIcon} from '@/components/Icons';
import Color from 'color';
import {Link} from 'expo-router';
import {LinearGradient} from 'expo-linear-gradient';
import {USE_GLASS} from '@/hooks/useGlassProps';

interface PlaylistCardProps {
  name: string;
  itemCount: number;
  color?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  playlistId?: string;
  width?: number;
  height?: number;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  name,
  itemCount,
  color,
  onPress,
  onLongPress,
  playlistId,
  width,
  height,
}) => {
  const {theme} = useTheme();

  const playlistColor = color || theme.colors.text;

  const cardWidth = width || moderateScale(100);
  const cardHeight = height || moderateScale(100);
  const iconSize = cardWidth * 0.28;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: cardWidth,
          height: cardHeight,
          overflow: 'hidden',
          borderRadius: moderateScale(14),
          backgroundColor: Color(playlistColor).alpha(0.06).toString(),
          borderWidth: 1,
          borderColor: Color(playlistColor).alpha(0.1).toString(),
        },
        cardPressed: {
          backgroundColor: Color(playlistColor).alpha(0.12).toString(),
        },
        iconArea: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        iconAccent: {
          width: moderateScale(36),
          height: moderateScale(36),
          borderRadius: moderateScale(18),
          backgroundColor: Color(playlistColor).alpha(0.1).toString(),
          justifyContent: 'center',
          alignItems: 'center',
        },
        gradient: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: moderateScale(8),
          paddingBottom: moderateScale(8),
          paddingTop: moderateScale(20),
        },
        name: {
          fontSize: moderateScale(10),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.text,
        },
        subtitle: {
          fontSize: moderateScale(8.5),
          fontFamily: 'Manrope-Regular',
          color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
          marginTop: moderateScale(1),
        },
      }),
    [theme, cardWidth, cardHeight, playlistColor],
  );

  const cardContent = (
    <View style={styles.card}>
      {/* Centered icon */}
      <View style={styles.iconArea}>
        <View style={styles.iconAccent}>
          <PlaylistIcon color={playlistColor} size={iconSize} />
        </View>
      </View>

      {/* Title overlay at bottom */}
      <LinearGradient
        colors={['transparent', Color(playlistColor).alpha(0.08).toString()]}
        style={styles.gradient}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {itemCount} {itemCount === 1 ? 'surah' : 'surahs'}
        </Text>
      </LinearGradient>
    </View>
  );

  if (playlistId) {
    return (
      <Link
        href={{
          pathname: '/(tabs)/(a.home)/playlist/[id]',
          params: {id: playlistId},
        }}
        asChild>
        <Pressable onLongPress={onLongPress}>
          {USE_GLASS ? (
            <Link.AppleZoom>{cardContent}</Link.AppleZoom>
          ) : (
            cardContent
          )}
        </Pressable>
      </Link>
    );
  }

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      {cardContent}
    </Pressable>
  );
};
