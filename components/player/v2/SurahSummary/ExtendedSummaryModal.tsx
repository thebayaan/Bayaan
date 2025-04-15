import React, {useMemo} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
  Text,
} from 'react-native';
import * as Linking from 'expo-linking';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from '@/components/modals/BaseModal';
import RenderHtml from 'react-native-render-html';
import type {
  CSSLongNativeTranslatableBlockPropKey,
  CSSLongNativeTranslatableTextPropKey,
} from 'react-native-render-html';

interface ExtendedSummaryModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  surahInfo: {
    surah_number: number;
    surah_name: string;
    text: string;
  };
}

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

export const ExtendedSummaryModal: React.FC<ExtendedSummaryModalProps> = ({
  bottomSheetRef,
  surahInfo,
}) => {
  const {theme} = useTheme();
  const {width} = useWindowDimensions();

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
      html: `<div>${surahInfo.text}</div>`,
    }),
    [surahInfo.text],
  );

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      title={`About ${surahInfo.surah_name}`}
      snapPoints={['80%']}>
      <Text style={[styles.sourceText, {color: theme.colors.textSecondary}]}>
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
        disableScrollViewPanResponder={Platform.OS === 'android'}
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
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: moderateScale(20),
  },
  htmlContent: {
    paddingHorizontal: moderateScale(10),
  },
  sourceText: {
    fontSize: moderateScale(10),
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingBottom: moderateScale(12),
    paddingHorizontal: moderateScale(16),
  },
  linkText: {
    fontFamily: 'Manrope-SemiBold',
    textDecorationLine: 'underline',
  },
});
