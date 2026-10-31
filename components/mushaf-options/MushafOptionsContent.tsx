// @ai-generated
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView as RNScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {runOnJS} from 'react-native-worklets';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {hideSheet} from '@/components/sheets/sheetControl';
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding';
import {isRTL} from '@/utils/rtl';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {FallbackBanner} from './FallbackBanner';
import {HighlightsCard} from './HighlightsCard';
import {MushafTextRow, MushafTextScreen} from './MushafTextScreen';
import {TextCard} from './TextCard';
import {LayoutSection, ThemeSection, ViewSection} from './TopSections';
import {UnderVerseCard, WordDetailsCard} from './WordCards';
import {
  EASE_OUT,
  FADE_MS,
  LoopsActiveContext,
  PUSH_MS,
  ThemeCrossfade,
} from './motion';
import {
  PAGE_INSET,
  SECTION_GAP,
  textAlpha,
  useOptionStyles,
} from './optionStyles';
import {toggleCard, type OptionsCard} from './readingLayout';
import {useSheetGrowth} from './useSheetGrowth';

export type MushafOptionsContext = 'mushaf' | 'player';

/**
 * The Reading options: View, Layout and Theme always showing, then folded
 * cards (one open at a time) and a row that pushes the Mushaf text screen.
 * Opening a card or the screen grows the sheet to its large height. From
 * the player, View and Layout are hidden and the sheet starts at Theme.
 * Fills its parent: the sheet, or the iPad popover.
 */
export function MushafOptionsContent({
  context = 'mushaf',
  ScrollComponent = RNScrollView,
  onClose,
  onGrow,
  crossfadeBackground = false,
}: {
  context?: MushafOptionsContext;
  /** The sheet passes its own ScrollView so drags scroll before closing. */
  ScrollComponent?: React.ComponentType<ScrollViewProps>;
  /** Closes the surface; the sheet's own hide by default. */
  onClose?: () => void;
  /** Snaps the React Native sheet to its top point. */
  onGrow?: () => void;
  /** Fade the sheet's own background on a theme change (no native sheet). */
  crossfadeBackground?: boolean;
}): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('sheets');
  const reduceMotion = useReducedMotion();
  const viewMode = useMushafSettingsStore(s => s.viewMode);
  const fromPlayer = context === 'player';
  // The player reads verse by verse, as the List view does.
  const listLike = fromPlayer || viewMode === 'list';

  const [openCard, setOpenCard] = useState<OptionsCard | null>(null);
  const [pushed, setPushed] = useState(false);
  const [pushMounted, setPushMounted] = useState(false);
  useSheetGrowth(openCard !== null || pushed, onGrow);

  // The cards the current view no longer shows cannot stay open.
  useEffect(() => {
    if (!listLike && openCard === 'verse') setOpenCard(null);
  }, [listLike, openCard]);

  const bottomPadding = useSheetBottomPadding(moderateScale(18), SECTION_GAP);
  const toggle = useCallback(
    (card: OptionsCard) => () => setOpenCard(open => toggleCard(open, card)),
    [],
  );
  const close = useCallback(() => {
    if (onClose) onClose();
    else hideSheet('mushaf-layout');
  }, [onClose]);

  // The Mushaf text screen slides in over the options; the options slide
  // a little the other way and fade. Under Reduce Motion they cross-fade.
  const push = useSharedValue(0);
  const width = useSharedValue(0);
  const direction = isRTL ? -1 : 1;
  const openScreen = useCallback(() => {
    setPushMounted(true);
    setPushed(true);
  }, []);
  const closeScreen = useCallback(() => setPushed(false), []);
  useEffect(() => {
    if (!pushMounted) return;
    push.value = withTiming(
      pushed ? 1 : 0,
      {duration: reduceMotion ? FADE_MS : PUSH_MS, easing: EASE_OUT},
      finished => {
        if (finished && !pushed) runOnJS(setPushMounted)(false);
      },
    );
  }, [pushed, pushMounted, reduceMotion, push]);
  const mainStyle = useAnimatedStyle(() => ({
    opacity: 1 - push.value,
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : -0.3 * width.value * push.value * direction,
      },
    ],
  }));
  const screenStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? push.value : 1,
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : (1 - push.value) * width.value * direction,
      },
    ],
  }));
  const onBodyLayout = (event: LayoutChangeEvent): void => {
    width.value = event.nativeEvent.layout.width;
  };

  return (
    <View style={local.root}>
      <View style={local.header}>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          {t('mushafOptions.title')}
        </Text>
        <Pressable
          onPress={close}
          style={({pressed}) => [local.close, pressed && local.closePressed]}
          accessibilityRole="button"
          accessibilityLabel={t('mushafOptions.close')}
          hitSlop={8}
          testID="mushaf-options-close">
          <Feather
            name="x"
            size={moderateScale(16)}
            color={theme.colors.text}
          />
        </Pressable>
      </View>
      <View style={local.body} onLayout={onBodyLayout}>
        <Animated.View
          style={[StyleSheet.absoluteFill, mainStyle]}
          pointerEvents={pushed ? 'none' : 'auto'}
          accessibilityElementsHidden={pushed}
          importantForAccessibility={pushed ? 'no-hide-descendants' : 'auto'}>
          <LoopsActiveContext.Provider value={!pushed}>
            <ScrollComponent
              style={local.scroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                local.content,
                {paddingBottom: bottomPadding},
              ]}>
              <FallbackBanner />
              {fromPlayer ? null : (
                <>
                  <ViewSection />
                  <LayoutSection />
                </>
              )}
              <ThemeSection />
              <TextCard
                open={openCard === 'text'}
                onToggle={toggle('text')}
                listLike={listLike}
              />
              {listLike ? (
                <UnderVerseCard
                  open={openCard === 'verse'}
                  onToggle={toggle('verse')}
                />
              ) : null}
              <HighlightsCard
                open={openCard === 'highlights'}
                onToggle={toggle('highlights')}
              />
              <WordDetailsCard
                open={openCard === 'words'}
                onToggle={toggle('words')}
              />
              <MushafTextRow onPress={openScreen} />
            </ScrollComponent>
          </LoopsActiveContext.Provider>
        </Animated.View>
        {pushMounted ? (
          <Animated.View style={[StyleSheet.absoluteFill, screenStyle]}>
            <MushafTextScreen
              onBack={closeScreen}
              ScrollComponent={ScrollComponent}
              bottomPadding={bottomPadding}
            />
          </Animated.View>
        ) : null}
      </View>
      {crossfadeBackground ? (
        <ThemeCrossfade color={theme.colors.background} />
      ) : null}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingStart: PAGE_INSET + moderateScale(6),
      paddingEnd: PAGE_INSET,
      paddingTop: moderateScale(4),
      paddingBottom: moderateScale(12),
    },
    close: {
      width: moderateScale(32),
      height: moderateScale(32),
      borderRadius: moderateScale(16),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: textAlpha(theme, 0.07),
    },
    closePressed: {
      backgroundColor: textAlpha(theme, 0.13),
    },
    body: {
      flex: 1,
      overflow: 'hidden',
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: PAGE_INSET,
      paddingTop: moderateScale(4),
    },
  });
}
