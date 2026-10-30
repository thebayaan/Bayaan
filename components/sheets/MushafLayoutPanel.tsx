// @ai-generated
import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  StyleSheet,
  LayoutAnimation,
  ScrollView as RNScrollView,
  type ScrollViewProps,
} from 'react-native';
import {ScaledSheet, moderateScale, verticalScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {MushafSettingsContent} from '@/components/MushafSettingsContent';
import {ReadingThemeContent} from '@/components/ReadingThemeContent';
import {flipX} from '@/utils/rtl';
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding'; // @ai
import {useNativeSheetId} from '@/components/native/nativeSheetContext'; // @ai

type ActiveScreen = 'theme' | null;
export type MushafLayoutContext = 'mushaf' | 'player';

/**
 * Reading settings with the reading-theme picker as a sub-screen. Fills its
 * parent: the sheet, or the iPad popover (which gives it a height).
 */
export function MushafLayoutPanel({
  context,
  ScrollComponent = RNScrollView,
}: {
  context?: MushafLayoutContext;
  /** The sheet passes its own ScrollView so drags scroll before closing. */
  ScrollComponent?: React.ComponentType<ScrollViewProps>;
}) {
  const {theme} = useTheme();
  const sheetBottomPadding = useSheetBottomPadding(moderateScale(40)); // @ai
  const inNativeSheet = useNativeSheetId() !== null; // @ai
  const {height: windowHeight} = useWindowDimensions();
  const styles = createStyles(theme, windowHeight);
  const {t} = useTranslation(['sheets', 'common']);
  const [activeScreen, setActiveScreenRaw] = useState<ActiveScreen>(null);

  const setActiveScreen = useCallback((screen: ActiveScreen) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'),
    );
    setActiveScreenRaw(screen);
  }, []);

  const handleBack = useCallback(() => {
    setActiveScreen(null);
  }, [setActiveScreen]);

  const handleOpenThemePicker = useCallback(() => {
    setActiveScreen('theme');
  }, [setActiveScreen]);

  return activeScreen === null ? (
    <ScrollComponent
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        {paddingBottom: sheetBottomPadding},
      ]}>
      <MushafSettingsContent
        showTitle={true}
        // @ai: in a native sheet the last card ends at the sheet's edge,
        // without the container's padding or the card's own bottom margin.
        containerStyle={inNativeSheet ? styles.flushBottom : undefined}
        context={context}
        onOpenThemePicker={handleOpenThemePicker}
      />
    </ScrollComponent>
  ) : (
    <View style={styles.subScreenContainer}>
      {/* Back header */}
      <View style={styles.backRowContainer}>
        <Pressable
          onPress={handleBack}
          style={({pressed}) => [styles.backRow, pressed && {opacity: 0.6}]}>
          <Feather
            name="chevron-left"
            size={moderateScale(20)}
            color={theme.colors.text}
            style={flipX}
          />
          <Text style={styles.backText}>{t('common:actions.back')}</Text>
        </Pressable>
        <Text style={styles.subScreenTitle}>
          {t('mushafLayout.readingTheme')}
        </Text>
        <View style={styles.backRowSpacer} />
      </View>

      {/* Theme picker content */}
      {activeScreen === 'theme' && <ReadingThemeContent onBack={handleBack} />}
    </View>
  );
}

export const createStyles = (theme: Theme, windowHeight: number) =>
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
      height: windowHeight * 0.82, // @ai
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
    // @ai: cancels MushafSettingsContent's bottom padding and the last
    // card's marginBottom (verticalScale(16)).
    flushBottom: {
      paddingBottom: 0,
      marginBottom: -verticalScale(16),
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
