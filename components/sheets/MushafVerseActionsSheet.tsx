import React from 'react';
import {View, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import {SURAH_NAMES} from '@/components/mushaf/constants';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';

export const MushafVerseActionsSheet = (
  props: SheetProps<'mushaf-verse-actions'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const clearSelection = useMushafVerseSelectionStore(s => s.clearSelection);

  const surahNumber = props.payload?.surahNumber ?? 1;
  const ayahNumber = props.payload?.ayahNumber ?? 1;
  const surahName = SURAH_NAMES[surahNumber] ?? '';

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onBeforeClose={clearSelection}>
      <View style={styles.content}>
        <Text style={styles.surahName}>سورة {surahName}</Text>
        <Text style={styles.ayahNumber}>Ayah {ayahNumber}</Text>
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    content: {
      alignItems: 'center',
      paddingVertical: moderateScale(24),
      paddingHorizontal: moderateScale(16),
    },
    surahName: {
      fontSize: moderateScale(22),
      fontFamily: 'Traditional-Arabic',
      color: theme.colors.text,
      marginBottom: moderateScale(4),
    },
    ayahNumber: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.6).toString(),
    },
  });
