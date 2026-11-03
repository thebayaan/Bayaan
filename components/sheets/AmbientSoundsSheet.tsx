// @ai-generated
import React from 'react';
import {SheetProps} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {useTheme} from '@/hooks/useTheme';
import {
  AmbientSoundsPanel,
  createStyles,
  stopAmbientSampling,
} from './AmbientSoundsPanel';

/**
 * AmbientSoundsSheet
 *
 * A bottom sheet for selecting ambient nature sounds and adjusting volume.
 * On iPad it is a menu beside the ambient button, or a popover anchored to
 * it in the player.
 */
export const AmbientSoundsSheet = (props: SheetProps<'ambient-sounds'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  return (
    <ActionSheet
      id={props.sheetId}
      tabletPresentation="menu"
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onBeforeClose={stopAmbientSampling}>
      <AmbientSoundsPanel />
    </ActionSheet>
  );
};
