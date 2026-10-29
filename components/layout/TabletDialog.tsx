// @ai-generated
import React, {useEffect, useState} from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {
  SHEET_MAX_HEIGHT,
  SHEET_MAX_WIDTH,
} from '@/components/sheets/AdaptiveActionSheet';

/** Closest the card comes to the safe area edges. */
const EDGE_MARGIN = 24;

export interface TabletDialogProps {
  onClose: () => void;
  /**
   * Fixed card height, capped to the window. Leave it out to fit the
   * content; give one when the content is a list that fills its parent.
   */
  height?: number;
  children: React.ReactNode;
}

/** Height of the on-screen keyboard, or 0 while it is hidden. */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e =>
      setHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

/**
 * An iPad form or picker that would be a full-screen page or a full-width
 * sheet on a phone: a centered card, the same size as the iPad sheet cards
 * (AdaptiveActionSheet), over a dimmed screen. A tap outside closes it, and
 * it moves up and shrinks to stay above the keyboard. Render it in a
 * transparent modal, a `transparentModal` route or a full-screen layer.
 */
export function TabletDialog({onClose, height, children}: TabletDialogProps) {
  const {theme} = useTheme();
  const {t} = useTranslation('common');
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const bottomInset = Math.max(insets.bottom, keyboardHeight);
  const maxHeight = Math.min(
    windowHeight - insets.top - bottomInset - 2 * EDGE_MARGIN,
    SHEET_MAX_HEIGHT,
  );

  return (
    <View
      style={[
        styles.root,
        {paddingTop: insets.top, paddingBottom: bottomInset},
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('actions.close')}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, styles.backdrop]}
      />
      <View
        accessibilityViewIsModal={true}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.background,
            borderColor: Color(theme.colors.text).alpha(0.08).toString(),
            maxHeight,
          },
          height != null && {height: Math.min(height, maxHeight)},
        ]}>
        {/* Clips the content to the corners; the outer view keeps the shadow. */}
        <View style={styles.clip}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EDGE_MARGIN,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  card: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  clip: {
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
