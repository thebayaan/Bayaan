// Long-press sheet of the adhkar card in Continue Listening. Styled like
// 'home-card-options' (same styles); its one action ends the session.
import React, {useCallback} from 'react';
import {Pressable, Text, View} from 'react-native';
import {type SheetProps} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {Feather} from '@expo/vector-icons';
import {moderateScale} from '@/utils/scale';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {createStyles} from './HomeCardOptionsSheet';
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding'; // @ai
import {hideSheet} from '@/components/sheets/sheetControl'; // @ai

export function AdhkarSessionOptionsSheet(
  props: SheetProps<'adhkar-session-options'>,
): React.JSX.Element {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const sheetBottomPadding = useSheetBottomPadding(moderateScale(40)); // @ai
  const {t} = useTranslation('home');
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  const {sheetId, payload} = props;

  const handleStop = useCallback(() => {
    dispatch({type: 'stop'});
    hideSheet('adhkar-session-options');
  }, [dispatch]);

  return (
    <ActionSheet
      id={sheetId}
      tabletPresentation="menu" // @ai
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={[styles.container, {paddingBottom: sheetBottomPadding}]}>
        {payload && (
          <View style={styles.header}>
            <Text style={styles.title}>{payload.title}</Text>
            <Text style={styles.subtitle}>{payload.subtitle}</Text>
          </View>
        )}
        <View style={styles.destructiveCard}>
          <Pressable
            testID="adhkar-session-stop"
            accessibilityRole="button"
            style={({pressed}) => [
              styles.optionDestructive,
              pressed && styles.optionDestructivePressed,
            ]}
            onPress={handleStop}>
            <Feather name="x-circle" size={moderateScale(18)} color="#ff4444" />
            <Text style={styles.optionTextDestructive}>
              {t('adhkar.stopSession')}
            </Text>
          </Pressable>
        </View>
      </View>
    </ActionSheet>
  );
}
