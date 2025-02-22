import React, {useMemo} from 'react';
import {View, StyleSheet, ScrollView, useWindowDimensions} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from '@/components/modals/BaseModal';
import RenderHtml from 'react-native-render-html';

interface ExtendedSummaryModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  surahInfo: {
    surah_name: string;
    text: string;
  };
}

const renderHtmlDefaultProps = {
  enableExperimentalMarginCollapsing: true,
  enableExperimentalGhostLinesPrevention: true,
  enableExperimentalBRCollapsing: true,
  allowedStyles: [],
  ignoredStyles: ['fontFamily', 'letterSpacing'],
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
        textDecorationLine: 'none',
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
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.content}>
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
  content: {
    paddingBottom: moderateScale(20),
  },
}); 