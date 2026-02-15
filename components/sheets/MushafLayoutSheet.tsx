import React from 'react';
import {View, ScrollView, Dimensions} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import {MushafSettingsContent} from '@/components/MushafSettingsContent';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const MushafLayoutSheet = (props: SheetProps<'mushaf-layout'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <MushafSettingsContent
          showTitle={true}
          context={props.payload?.context}
        />
      </ScrollView>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      height: SCREEN_HEIGHT * 0.6,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: moderateScale(40),
    },
  });
