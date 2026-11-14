import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ScrollView,
  SheetManager,
  type SheetProps,
} from 'react-native-actions-sheet';
import {router} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import ActionSheet, {
  useSheetWidth,
} from '@/components/sheets/AdaptiveActionSheet';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {SURAHS} from '@/data/surahData';
import {useTheme} from '@/hooks/useTheme';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {RECITATION_DOWNLOAD_MB} from '@/constants/recitation';
import {formatNumber, getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {recitationModelNeedsDownload} from '@/services/recitation/engineHost';
import {
  startAyahIdentify,
  stopAyahIdentify,
} from '@/services/recitation/identify/AyahIdentifyService';
import {
  useAyahIdentifyStore,
  type IdentifiedAyah,
  type IdentifyErrorCode,
} from '@/store/ayahIdentifyStore';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';

// Which ayah?: listens and names the ayah being recited, by the reader or
// anyone nearby, then offers to open or play it. Opened from "Recite to
// search" in the search tab. Recognition is Hafs only and on the phone.

/** Places worded the same shown as chips; the rest as "+N". */
const TWIN_CHIPS = 3;
/** Long ayat (2:282) scroll inside this share of the screen height, so the
 *  buttons below stay on screen. */
const AYAH_MAX_HEIGHT_SHARE = 0.35;
const SHEET_PADDING = 20;

const ERROR_KEYS = {
  permission: 'whichAyah.errors.permission',
  download: 'whichAyah.errors.download',
  mic: 'whichAyah.errors.mic',
  interrupted: 'whichAyah.errors.interrupted',
  other: 'whichAyah.errors.other',
} as const satisfies Record<IdentifyErrorCode, string>;

function keyOf(ayah: IdentifiedAyah): string {
  return `${ayah.surah}:${ayah.ayah}`;
}

function parseKey(key: string): IdentifiedAyah {
  const [surah, ayah] = key.split(':').map(Number);
  return {surah, ayah};
}

export const WhichAyahSheet = (
  props: SheetProps<'which-ayah'>,
): React.JSX.Element => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  // null while checking whether the model is on the phone.
  const [askFirst, setAskFirst] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void recitationModelNeedsDownload().then(needsDownload => {
      if (cancelled) return;
      setAskFirst(needsDownload);
      if (!needsDownload) void startAyahIdentify();
    });
    return () => {
      cancelled = true;
      void stopAyahIdentify();
    };
  }, []);

  const begin = useCallback(() => {
    setAskFirst(false);
    void startAyahIdentify();
  }, []);

  const openAt = useCallback(
    async (ayah: IdentifiedAyah, play: boolean) => {
      const key = keyOf(ayah);
      const page = digitalKhattDataService.getPageForVerse(key);
      await stopAyahIdentify();
      await SheetManager.hide(props.sheetId);
      router.push({
        pathname: '/mushaf',
        params: {
          surah: String(ayah.surah),
          ayah: String(ayah.ayah),
          ...(page ? {page: String(page)} : {}),
        },
      });
      if (!play || !page) return;
      const player = useMushafPlayerStore.getState();
      if (!player.rewayatId) {
        // No mushaf reciter yet: ask for one, then play from this ayah, as
        // the verse sheet's Play does.
        useMushafPlayerStore.setState({
          currentPage: page,
          pendingStartVerseKey: key,
        });
        SheetManager.show('mushaf-player-options', {
          payload: {currentPage: page},
        });
        return;
      }
      // As the verse sheet's Play: from this ayah to the end of the surah.
      const lastAyah = SURAHS[ayah.surah - 1]?.verses_count ?? ayah.ayah;
      player.setRange(
        {surah: ayah.surah, ayah: ayah.ayah},
        {surah: ayah.surah, ayah: lastAyah},
      );
      player.setVerseRepeatCount(1);
      player.setRangeRepeatCount(1);
      await player.startPlayback(page, key);
    },
    [props.sheetId],
  );

  return (
    <ActionSheet
      id={props.sheetId}
      tabletPresentation="card"
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('whichAyah.title')}</Text>
      </View>
      <View style={styles.container}>
        {askFirst === true ? (
          <Intro
            styles={styles}
            theme={theme}
            onStart={begin}
            onNotNow={() => void SheetManager.hide(props.sheetId)}
          />
        ) : (
          <IdentifyBody
            styles={styles}
            theme={theme}
            onOpen={openAt}
            onRetry={begin}
          />
        )}
      </View>
    </ActionSheet>
  );
};

type Styles = ReturnType<typeof createStyles>;

function Intro({
  styles,
  theme,
  onStart,
  onNotNow,
}: {
  styles: Styles;
  theme: Theme;
  onStart: () => void;
  onNotNow: () => void;
}): React.JSX.Element {
  const {t} = useTranslation('sheets');
  const points = [
    {icon: 'lock', text: t('whichAyah.intro.onDevice')},
    {
      icon: 'download',
      text: t('whichAyah.intro.download', {
        size: formatNumber(RECITATION_DOWNLOAD_MB),
      }),
    },
    {icon: 'info', text: t('whichAyah.intro.hafs')},
  ] as const;
  return (
    <>
      {points.map(point => (
        <View key={point.icon} style={styles.point}>
          <Feather
            name={point.icon}
            size={moderateScale(18)}
            color={theme.colors.text}
          />
          <Text style={styles.pointText}>{point.text}</Text>
        </View>
      ))}
      <PrimaryButton
        styles={styles}
        theme={theme}
        label={t('whichAyah.intro.start')}
        onPress={onStart}
      />
      <SecondaryButton
        styles={styles}
        label={t('whichAyah.intro.notNow')}
        onPress={onNotNow}
      />
    </>
  );
}

function IdentifyBody({
  styles,
  theme,
  onOpen,
  onRetry,
}: {
  styles: Styles;
  theme: Theme;
  onOpen: (ayah: IdentifiedAyah, play: boolean) => Promise<void>;
  onRetry: () => void;
}): React.JSX.Element {
  const {t} = useTranslation(['sheets', 'common']);
  const status = useAyahIdentifyStore(s => s.status);
  const progress = useAyahIdentifyStore(s => s.downloadProgress);
  const error = useAyahIdentifyStore(s => s.error);

  switch (status) {
    case 'found':
      return (
        <FoundAyah
          styles={styles}
          theme={theme}
          onOpen={onOpen}
          onRetry={onRetry}
        />
      );
    case 'downloading':
      return (
        <Waiting
          styles={styles}
          theme={theme}
          text={t('whichAyah.downloading', {
            percent: localizeDigits(Math.round(progress * 100)),
          })}
        />
      );
    case 'listening':
    case 'paused':
      return (
        <View style={styles.listening}>
          <View style={styles.micCircle}>
            <Feather
              name={status === 'paused' ? 'pause' : 'mic'}
              size={moderateScale(28)}
              color={theme.colors.text}
            />
          </View>
          <Text style={styles.statusText}>
            {status === 'paused'
              ? t('whichAyah.paused')
              : t('whichAyah.listening')}
          </Text>
          {status === 'listening' && (
            <Text style={styles.hintText}>{t('whichAyah.listeningHint')}</Text>
          )}
        </View>
      );
    case 'stopped':
      return (
        <>
          <Text style={styles.statusText}>{t('whichAyah.stopped')}</Text>
          <PrimaryButton
            styles={styles}
            theme={theme}
            label={t('whichAyah.listenAgain')}
            onPress={onRetry}
          />
        </>
      );
    case 'notFound':
      return (
        <>
          <Text style={styles.statusText}>{t('whichAyah.notFound')}</Text>
          <Text style={styles.hintText}>{t('whichAyah.notFoundHint')}</Text>
          <PrimaryButton
            styles={styles}
            theme={theme}
            label={t('common:actions.tryAgain')}
            onPress={onRetry}
          />
        </>
      );
    case 'error':
      return (
        <>
          <Text style={styles.statusText}>
            {t(ERROR_KEYS[error?.code ?? 'other'])}
          </Text>
          {error?.code === 'permission' ? (
            <PrimaryButton
              styles={styles}
              theme={theme}
              label={t('whichAyah.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
          ) : (
            <PrimaryButton
              styles={styles}
              theme={theme}
              label={t('common:actions.tryAgain')}
              onPress={onRetry}
            />
          )}
        </>
      );
    default:
      // idle (about to start) and loading
      return (
        <Waiting styles={styles} theme={theme} text={t('whichAyah.loading')} />
      );
  }
}

function FoundAyah({
  styles,
  theme,
  onOpen,
  onRetry,
}: {
  styles: Styles;
  theme: Theme;
  onOpen: (ayah: IdentifiedAyah, play: boolean) => Promise<void>;
  onRetry: () => void;
}): React.JSX.Element | null {
  const {t} = useTranslation(['sheets', 'common']);
  const current = useAyahIdentifyStore(s => s.current ?? s.match);
  const twins = useAyahIdentifyStore(s => s.twins);
  const micOn = useAyahIdentifyStore(s => s.micOn);
  const hafsMushaf = useMushafSettingsStore(s => s.rewayah === 'hafs');
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const fontMgr = useMushafFontMgr();
  const sheetWidth = useSheetWidth();
  const {height: windowHeight} = useWindowDimensions();
  if (!current) return null;
  const surah = SURAHS[current.surah - 1];
  const textWidth = sheetWidth - moderateScale(SHEET_PADDING) * 2;

  return (
    <>
      <Text style={styles.ayahHeading}>
        {t('whichAyah.ayahHeading', {
          surah: surah ? getSurahDisplayName(surah) : '',
          ayah: localizeDigits(current.ayah),
        })}
      </Text>
      {fontMgr && textWidth > 0 ? (
        <ScrollView
          style={{maxHeight: Math.round(windowHeight * AYAH_MAX_HEIGHT_SHARE)}}
          showsVerticalScrollIndicator={true}>
          <SkiaVerseText
            verseKey={keyOf(current)}
            rewayah="hafs"
            fontMgr={fontMgr}
            fontFamily={getDkFontFamily(mushafRenderer, 'hafs')}
            fontSize={moderateScale(22)}
            textColor={theme.colors.text}
            showTajweed={false}
            width={textWidth}
            indexedTajweedData={null}
            arabicTextWeight={arabicTextWeight}
            textAlign="center"
          />
        </ScrollView>
      ) : null}
      {twins.length > 0 && (
        <View style={styles.twins}>
          <Text style={styles.hintText}>{t('whichAyah.twinsTitle')}</Text>
          <View style={styles.chips}>
            {twins.slice(0, TWIN_CHIPS).map(key => (
              <Pressable
                key={key}
                style={styles.chip}
                onPress={() => void onOpen(parseKey(key), false)}
                accessibilityRole="button">
                <Text style={styles.chipText}>{localizeDigits(key)}</Text>
              </Pressable>
            ))}
            {twins.length > TWIN_CHIPS && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {t('whichAyah.twinsMore', {
                    n: localizeDigits(twins.length - TWIN_CHIPS),
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
      <PrimaryButton
        styles={styles}
        theme={theme}
        label={t('whichAyah.openMushaf')}
        onPress={() => onOpen(current, false)}
      />
      {hafsMushaf && (
        <SecondaryButton
          styles={styles}
          label={t('verseActions.playFromHere')}
          onPress={() => onOpen(current, true)}
        />
      )}
      {micOn ? (
        <View style={styles.following}>
          <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          <Text style={styles.hintText}>{t('whichAyah.following')}</Text>
        </View>
      ) : (
        <SecondaryButton
          styles={styles}
          label={t('whichAyah.listenAgain')}
          onPress={onRetry}
        />
      )}
    </>
  );
}

function Waiting({
  styles,
  theme,
  text,
}: {
  styles: Styles;
  theme: Theme;
  text: string;
}): React.JSX.Element {
  return (
    <View style={styles.listening}>
      <ActivityIndicator size="small" color={theme.colors.text} />
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

function PrimaryButton({
  styles,
  theme,
  label,
  onPress,
}: {
  styles: Styles;
  theme: Theme;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.primaryButton, {backgroundColor: theme.colors.text}]}
      onPress={onPress}
      accessibilityRole="button">
      <Text
        style={[styles.primaryButtonText, {color: theme.colors.background}]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({
  styles,
  label,
  onPress,
}: {
  styles: Styles;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={styles.secondaryButton}
      onPress={onPress}
      accessibilityRole="button">
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
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
      paddingHorizontal: moderateScale(SHEET_PADDING),
      paddingTop: moderateScale(20),
      paddingBottom: moderateScale(40),
      gap: moderateScale(14),
    },
    point: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: moderateScale(12),
    },
    pointText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(20),
    },
    listening: {
      alignItems: 'center',
      gap: moderateScale(10),
      paddingVertical: moderateScale(16),
    },
    micCircle: {
      width: moderateScale(64),
      height: moderateScale(64),
      borderRadius: moderateScale(32),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    statusText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    hintText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    ayahHeading: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    twins: {
      gap: moderateScale(8),
      alignItems: 'center',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: moderateScale(8),
    },
    chip: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(14),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    chipText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    following: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(8),
    },
    primaryButton: {
      marginTop: moderateScale(4),
      paddingVertical: moderateScale(14),
      borderRadius: moderateScale(12),
      alignItems: 'center',
    },
    primaryButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
    },
    secondaryButton: {
      paddingVertical: moderateScale(8),
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
  });
