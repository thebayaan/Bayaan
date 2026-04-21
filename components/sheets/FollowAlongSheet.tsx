import React, {useMemo} from 'react';
import {View, Text, FlatList, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useTimestampStore} from '@/store/timestampStore';
import {ReciterItem} from '@/components/ReciterItem';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {SheetManager} from 'react-native-actions-sheet';

export const FollowAlongSheet = (props: SheetProps<'follow-along'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {navigateToReciterProfile} = useReciterNavigation();

  const supportedReciters = useMemo(() => {
    const {supportedReciterIds} = useTimestampStore.getState();
    return RECITERS.filter(r => supportedReciterIds.has(r.id));
  }, []);

  const handleReciterPress = (reciter: Reciter) => {
    SheetManager.hide('follow-along');
    navigateToReciterProfile(reciter.id);
  };

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Follow Along</Text>
      </View>
      <View style={styles.container}>
        <Text style={styles.description}>
          Verse-by-verse playback is not supported by the current reciter. Try
          one of these reciters instead:
        </Text>
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
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
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
