import React, {useCallback} from 'react';
import {View, Text, Pressable, FlatList} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetManager,
  SheetProps,
} from 'react-native-actions-sheet';
import Color from 'color';
import {SURAHS} from '@/data/surahData';

export const MushafSurahSheet = (
  props: SheetProps<'mushaf-surah-selector'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const currentSurahId = props.payload?.currentSurahId ?? 1;
  const onSelect = props.payload?.onSelect;

  const handleSelect = useCallback(
    (surahId: number) => {
      onSelect?.(surahId);
      SheetManager.hide('mushaf-surah-selector');
    },
    [onSelect],
  );

  const renderItem = useCallback(
    ({item}: {item: (typeof SURAHS)[0]}) => {
      const isCurrentSurah = item.id === currentSurahId;
      return (
        <Pressable
          style={[
            styles.surahItem,
            isCurrentSurah && {
              backgroundColor: Color(theme.colors.primary)
                .alpha(0.12)
                .toString(),
            },
          ]}
          onPress={() => handleSelect(item.id)}>
          <View style={styles.surahNumberContainer}>
            <Text style={[styles.surahNumber, {color: theme.colors.text}]}>
              {item.id}
            </Text>
          </View>
          <View style={styles.surahInfo}>
            <Text style={[styles.surahNameArabic, {color: theme.colors.text}]}>
              {item.name_arabic}
            </Text>
            <Text
              style={[
                styles.surahNameEnglish,
                {color: Color(theme.colors.text).alpha(0.6).toString()},
              ]}>
              {item.name}
            </Text>
          </View>
          <Text
            style={[
              styles.surahVerses,
              {color: Color(theme.colors.text).alpha(0.5).toString()},
            ]}>
            {item.verses_count} Ayat
          </Text>
        </Pressable>
      );
    },
    [currentSurahId, handleSelect, theme.colors, styles],
  );

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Select Surah</Text>
      </View>
      <FlatList
        data={SURAHS}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={Math.max(0, currentSurahId - 3)}
        getItemLayout={(_, index) => ({
          length: 64,
          offset: 64 * index,
          index,
        })}
        style={styles.list}
      />
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
      height: '70%',
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    list: {
      flex: 1,
    },
    surahItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(8),
      height: 64,
    },
    surahNumberContainer: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(18),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    surahNumber: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
    },
    surahInfo: {
      flex: 1,
    },
    surahNameArabic: {
      fontSize: moderateScale(18),
      fontFamily: 'Traditional-Arabic',
      textAlign: 'left',
    },
    surahNameEnglish: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      marginTop: 2,
    },
    surahVerses: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
    },
  });
