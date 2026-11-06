// @ai-generated
import React, {useEffect} from 'react';
import {Pressable, Text, View} from 'react-native';
import {SheetProps} from 'react-native-actions-sheet';
import {useTranslation} from 'react-i18next';
import Color from 'color';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {hideSheet, showSheet} from '@/components/sheets/sheetControl';
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding';
import {SURAHS} from '@/data/surahData';
import {useTheme} from '@/hooks/useTheme';
import {getSurahDisplayName} from '@/i18n/format';
import {playbackErrorText} from '@/i18n/playback';
import {
  isRetryablePlaybackError,
  useMushafPlayerStore,
} from '@/store/mushafPlayerStore';
import {moderateScale, ScaledSheet} from '@/utils/scale';

/**
 * Why the mushaf refused to play, and the one thing to do about it, for the
 * iOS 26 toolbar: it has no room to say so itself.
 */
export const MushafPlaybackNoticeSheet = (
  props: SheetProps<'mushaf-playback-notice'>,
): React.JSX.Element => {
  const {theme} = useTheme();
  const {t} = useTranslation('reader');
  const bottomPadding = useSheetBottomPadding(moderateScale(16));
  const error = useMushafPlayerStore(s => s.timestampError);
  const surah = useMushafPlayerStore(s => s.timestampErrorSurah);
  const [shownError, setShownError] = React.useState(error);

  // A retry started by a returning connection clears the error.
  useEffect(() => {
    if (error) setShownError(error);
    else hideSheet('mushaf-playback-notice');
  }, [error]);

  const retryable = isRetryablePlaybackError(shownError);

  const handleAction = (): void => {
    const player = useMushafPlayerStore.getState();
    if (retryable) {
      player.retryPlayback();
      return;
    }
    const page = player.currentPage ?? 1;
    useMushafPlayerStore.setState({timestampError: null});
    showSheet('mushaf-player-options', {payload: {currentPage: page}});
  };

  return (
    <ActionSheet
      id={props.sheetId}
      gestureEnabled
      onClose={() => useMushafPlayerStore.setState({timestampError: null})}
      containerStyle={{backgroundColor: theme.colors.background}}>
      <View style={[styles.body, {paddingBottom: bottomPadding}]}>
        <Text style={[styles.title, {color: theme.colors.text}]}>
          {t('playback.unavailable')}
        </Text>
        <Text
          style={[styles.message, {color: theme.colors.textSecondary}]}
          accessibilityLiveRegion="polite">
          {shownError
            ? playbackErrorText(
                shownError,
                surah ? getSurahDisplayName(SURAHS[surah - 1]) : '',
              )
            : ''}
        </Text>
        <Pressable
          style={[
            styles.action,
            {backgroundColor: Color(theme.colors.text).alpha(0.1).toString()},
          ]}
          onPress={handleAction}
          accessibilityRole="button">
          <Text style={[styles.actionText, {color: theme.colors.text}]}>
            {retryable
              ? t('playback.tryAgain')
              : t('playerBar.changeReciterButton')}
          </Text>
        </Pressable>
      </View>
    </ActionSheet>
  );
};

const styles = ScaledSheet.create({
  body: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(20),
    gap: moderateScale(10),
  },
  title: {
    fontSize: moderateScale(17),
    fontFamily: 'Manrope-Bold',
  },
  message: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontFamily: 'Manrope-Regular',
  },
  action: {
    marginTop: moderateScale(8),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
  },
});
