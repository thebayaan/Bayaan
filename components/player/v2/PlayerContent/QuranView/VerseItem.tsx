import React, {memo} from 'react';
import {Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Verse} from '@/types/quran';

interface VerseItemProps {
  verse: Verse;
  onPress: () => void;
  textColor: string;
  borderColor: string;
}

export const VerseItem = memo<VerseItemProps>(
  ({verse, onPress, textColor, borderColor}) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.container, {borderBottomColor: borderColor}]}
      onPress={onPress}>
      <Text style={[styles.arabicText, {color: textColor}]}>{verse.text}</Text>
    </TouchableOpacity>
  ),
);

VerseItem.displayName = 'VerseItem';

const styles = StyleSheet.create({
  container: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  arabicText: {
    fontSize: moderateScale(24),
    fontFamily: 'Uthmani',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
