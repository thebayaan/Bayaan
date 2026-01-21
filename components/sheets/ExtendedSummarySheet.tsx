import React, {useMemo} from 'react';
import {
  View,
  ScrollView,
  useWindowDimensions,
  Platform,
  Text,
  Dimensions,
} from 'react-native';
import * as Linking from 'expo-linking';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import RenderHtml from 'react-native-render-html';
import type {
  CSSLongNativeTranslatableBlockPropKey,
  CSSLongNativeTranslatableTextPropKey,
} from 'react-native-render-html';
import Color from 'color';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const renderHtmlDefaultProps = {
  enableExperimentalMarginCollapsing: true,
  enableExperimentalGhostLinesPrevention: true,
  enableExperimentalBRCollapsing: true,
  allowedStyles: [],
  ignoredStyles: ['fontFamily', 'letterSpacing'] as (
    | CSSLongNativeTranslatableBlockPropKey
    | CSSLongNativeTranslatableTextPropKey
  )[],
  enableCSSInlineProcessing: true,
  systemFonts: ['Manrope-Regular', 'Manrope-Medium', 'Manrope-Bold'],
  baseStyle: {
    color: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'Manrope-Regular',
  },
};

export const ExtendedSummarySheet = (props: SheetProps<'extended-summary'>) => {
  const {theme} = useTheme();
  const {width} = useWindowDimensions();
  const styles = createStyles(theme);

  const payload = props.payload;
  const surahInfo = payload?.surahInfo;

  const handleLinkPress = async () => {
    if (!surahInfo?.surah_number) return;
    const url = `https://quran.com/surah/${surahInfo.surah_number}/info`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.log(`Don't know how to open this URL: ${url}`);
      }
    } catch (error) {
      console.error('An error occurred', error);
    }
  };

  const tagsStyles = useMemo(
    () => ({
      div: {
        color: theme.colors.text,
        fontSize: moderateScale(16),
        fontFamily: 'Manrope-Regular',
        lineHeight: moderateScale(24),
      },
      p: {
        marginBottom: moderateScale(16),
      },
      a: {
        color: theme.colors.primary,
      },
      li: {
        marginBottom: moderateScale(8),
      },
      ul: {
        marginBottom: moderateScale(16),
        paddingLeft: moderateScale(16),
      },
      ol: {
        marginBottom: moderateScale(16),
        paddingLeft: moderateScale(16),
      },
    }),
    [theme.colors.text, theme.colors.primary],
  );

  const source = useMemo(
    () => ({
      html: surahInfo?.text ? `<div>${surahInfo.text}</div>` : '<div></div>',
    }),
    [surahInfo?.text],
  );

  if (!surahInfo) {
    return null;
  }

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>About {surahInfo.surah_name}</Text>
      </View>
      <Text style={styles.sourceText}>
        Retrieved from{' '}
        <Text style={styles.linkText} onPress={handleLinkPress}>
          Quran.com
        </Text>
      </Text>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled={Platform.OS === 'android'}
        scrollEventThrottle={16}>
        <View style={styles.htmlContent}>
          <RenderHtml
            {...renderHtmlDefaultProps}
            contentWidth={width - moderateScale(72)}
            source={source}
            tagsStyles={tagsStyles}
          />
        </View>
      </ScrollView>
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
      height: SCREEN_HEIGHT * 0.8,
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: moderateScale(40),
    },
    htmlContent: {
      paddingHorizontal: moderateScale(20),
    },
    sourceText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Regular',
      textAlign: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      color: theme.colors.textSecondary,
    },
    linkText: {
      fontFamily: 'Manrope-SemiBold',
      textDecorationLine: 'underline',
    },
  });
