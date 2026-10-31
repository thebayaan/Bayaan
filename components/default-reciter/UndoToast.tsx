// @ai-generated
import React, {useEffect, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import Animated, {FadeInUp, FadeOutUp} from 'react-native-reanimated';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {moderateScale} from '@/utils/scale';

const VISIBLE_MS = 4000;

interface Props {
  message: string;
  /**
   * Where the pill sits: under the navigation bar (`top`), or above the
   * keyboard while it is open (`bottom`).
   */
  top?: number;
  bottom?: number;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * A confirmation pill with Undo that hides itself after a few seconds, on an
 * overlay above the list so its taps never reach the rows beneath.
 */
export function UndoToast({message, top, bottom, onUndo, onDismiss}: Props) {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        entering={FadeInUp.duration(220)}
        exiting={FadeOutUp.duration(180)}
        style={[styles.toast, {top, bottom}]}
        pointerEvents="auto"
        accessibilityLiveRegion="polite">
        <Feather
          name="check"
          size={moderateScale(16)}
          color={theme.colors.background}
        />
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          style={({pressed}) => [styles.undo, pressed && styles.pressed]}>
          <Text style={styles.undoText}>{t('defaultReciter.undo')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      start: 0,
      end: 0,
      zIndex: 10,
      elevation: 10,
    },
    toast: {
      position: 'absolute',
      start: moderateScale(16),
      end: moderateScale(16),
      alignSelf: 'center',
      maxWidth: 520,
      minHeight: moderateScale(54),
      borderRadius: moderateScale(27),
      backgroundColor: theme.colors.text,
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(10),
      paddingStart: moderateScale(18),
      paddingEnd: moderateScale(8),
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 18,
      shadowOffset: {width: 0, height: 10},
      elevation: 8,
    },
    message: {
      flex: 1,
      fontSize: theme.typography.mediumSize,
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.background,
      textAlign: 'left',
    },
    undo: {
      height: moderateScale(38),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(19),
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.background).alpha(0.16).toString(),
    },
    undoText: {
      fontSize: theme.typography.mediumSize,
      fontFamily: 'Manrope-Bold',
      color: theme.colors.background,
    },
    pressed: {
      opacity: 0.7,
    },
  });
