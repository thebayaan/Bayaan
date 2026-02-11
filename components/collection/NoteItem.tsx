import React, {memo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';

interface NoteItemProps {
  surahName: string;
  ayahNumber: number;
  surahNumber: number;
  notePreview: string;
  onPress: () => void;
  onOptionsPress: () => void;
}

export const NoteItem = memo<NoteItemProps>(
  ({
    surahName,
    ayahNumber,
    surahNumber,
    notePreview,
    onPress,
    onOptionsPress,
  }) => {
    const {theme} = useTheme();

    return (
      <Pressable style={styles.container} onPress={onPress}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: Color('#3B82F6').alpha(0.15).toString(),
            },
          ]}>
          <Feather name="file-text" size={moderateScale(20)} color="#3B82F6" />
        </View>
        <View style={styles.info}>
          <Text
            style={[styles.topLine, {color: theme.colors.text}]}
            numberOfLines={1}>
            {surahName}{' '}
            <Text style={[styles.ayahRef, {color: theme.colors.textSecondary}]}>
              Ayah {ayahNumber}
            </Text>
          </Text>
          <Text
            style={[styles.notePreview, {color: theme.colors.textSecondary}]}
            numberOfLines={2}>
            {notePreview}
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

NoteItem.displayName = 'NoteItem';

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
  topLine: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
    marginBottom: moderateScale(2),
  },
  ayahRef: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Regular',
  },
  notePreview: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Regular',
    lineHeight: moderateScale(16),
  },
  optionsButton: {
    padding: moderateScale(4),
  },
});
