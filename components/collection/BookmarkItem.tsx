import React, {memo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';

interface BookmarkItemProps {
  surahName: string;
  ayahNumber: number;
  surahNumber: number;
  onPress: () => void;
  onOptionsPress: () => void;
}

export const BookmarkItem = memo<BookmarkItemProps>(
  ({surahName, ayahNumber, surahNumber, onPress, onOptionsPress}) => {
    const {theme} = useTheme();

    return (
      <Pressable style={styles.container} onPress={onPress}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: Color('#F59E0B').alpha(0.15).toString(),
            },
          ]}>
          <Feather name="bookmark" size={moderateScale(20)} color="#F59E0B" />
        </View>
        <View style={styles.info}>
          <Text
            style={[styles.surahName, {color: theme.colors.text}]}
            numberOfLines={1}>
            {surahName}
          </Text>
          <Text style={[styles.ayahLabel, {color: theme.colors.textSecondary}]}>
            Ayah {ayahNumber}
          </Text>
        </View>
        <Pressable
          onPress={onOptionsPress}
          hitSlop={8}
          style={({pressed}) => [
            styles.optionsButton,
            {opacity: pressed ? 0.5 : 1},
          ]}>
          <Feather
            name="more-horizontal"
            size={moderateScale(18)}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </Pressable>
    );
  },
);

BookmarkItem.displayName = 'BookmarkItem';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(16),
  },
  iconContainer: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(14),
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  surahName: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
    marginBottom: moderateScale(2),
  },
  ayahLabel: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Regular',
  },
  optionsButton: {
    padding: moderateScale(4),
  },
});
