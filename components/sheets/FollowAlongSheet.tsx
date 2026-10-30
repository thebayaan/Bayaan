import React, {useMemo} from 'react';
import {View, Text, FlatList, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {SheetProps} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import Color from 'color';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useTimestampStore} from '@/store/timestampStore';
import {ReciterItem} from '@/components/ReciterItem';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
// @ai-start
import {useTranslation} from 'react-i18next';
import {hideSheet} from '@/components/sheets/sheetControl'; // @ai
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding'; // @ai
import {useNativeSheetId} from '@/components/native/nativeSheetContext'; // @ai
// @ai-end

// @ai-start
export const FollowAlongSheet = (props: SheetProps<'follow-along'>) => {
  const {theme} = useTheme();
  const sheetBottomPadding = useSheetBottomPadding(moderateScale(40)); // @ai
  const inNativeSheet = useNativeSheetId() !== null; // @ai
  const styles = createStyles(theme);
  const {navigateToReciterProfile} = useReciterNavigation();
  const {t} = useTranslation('sheets');

  const supportedReciters = useMemo(() => {
    const {supportedReciterIds} = useTimestampStore.getState();
    return RECITERS.filter(r => supportedReciterIds.has(r.id));
  }, []);

  const handleReciterPress = (reciter: Reciter) => {
    hideSheet('follow-along');
    navigateToReciterProfile(reciter.id);
  };

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('followAlong.title')}</Text>
      </View>
      <View
        style={[
          styles.container,
          {paddingBottom: sheetBottomPadding},
          // @ai: bounded by a native sheet, so the list scrolls inside it
          inNativeSheet && styles.fill,
        ]}>
        <Text style={styles.description}>{t('followAlong.description')}</Text>
        <FlatList
          data={supportedReciters}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <ReciterItem
              item={item}
              onPress={handleReciterPress}
              showFollowAlong
            />
          )}
          style={[styles.list, inNativeSheet && styles.fill]}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ActionSheet>
  );
};
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      maxHeight: '80%',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    fill: {flex: 1}, // @ai
    container: {
      paddingVertical: moderateScale(16),
      paddingBottom: moderateScale(40),
    },
    description: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(20),
      paddingHorizontal: moderateScale(20),
      marginBottom: moderateScale(16),
    },
    list: {
      maxHeight: moderateScale(400),
    },
  });
