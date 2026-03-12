import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  StyleSheet,
  LayoutAnimation,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps, ScrollView} from 'react-native-actions-sheet';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {MushafSettingsContent} from '@/components/MushafSettingsContent';
import {ReadingThemeContent} from '@/components/ReadingThemeContent';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type ActiveScreen = 'theme' | null;

export const MushafLayoutSheet = (props: SheetProps<'mushaf-layout'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [activeScreen, setActiveScreenRaw] = useState<ActiveScreen>(null);

  const setActiveScreen = useCallback((screen: ActiveScreen) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'),
    );
    setActiveScreenRaw(screen);
  }, []);

  const handleBack = useCallback(() => {
    setActiveScreen(null);
  }, []);

  const handleOpenThemePicker = useCallback(() => {
    setActiveScreen('theme');
  }, []);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onClose={() => setActiveScreenRaw(null)}>
      {activeScreen === null ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <MushafSettingsContent
            showTitle={true}
            context={props.payload?.context}
            onOpenThemePicker={handleOpenThemePicker}
          />
        </ScrollView>
      ) : (
        <View style={styles.subScreenContainer}>
          {/* Back header */}
          <View style={styles.backRowContainer}>
            <Pressable
              onPress={handleBack}
              style={({pressed}) => [
                styles.backRow,
                pressed && {opacity: 0.6},
              ]}>
              <Feather
                name="chevron-left"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.subScreenTitle}>Reading Theme</Text>
            <View style={styles.backRowSpacer} />
          </View>

          {/* Theme picker content */}
          {activeScreen === 'theme' && (
            <ReadingThemeContent onBack={handleBack} />
          )}
        </View>
      )}
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      paddingTop: moderateScale(8),
      height: SCREEN_HEIGHT * 0.82,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: moderateScale(40),
    },
    subScreenContainer: {
      flex: 1,
    },
    backRowContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(10),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginBottom: moderateScale(12),
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    backText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    subScreenTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    backRowSpacer: {
      width: moderateScale(60),
    },
  });
