import React, {useState} from 'react';
import {useWindowDimensions} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {SheetProps, ScrollView} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {createStyles, MushafLayoutPanel} from './MushafLayoutPanel'; // @ai

// @ai-start
export const MushafLayoutSheet = (props: SheetProps<'mushaf-layout'>) => {
  const {theme} = useTheme();
  // Height follows the current window (the Mushaf rotates), not the one at
  // import time, which overflowed the screen in landscape.
  const {height: windowHeight} = useWindowDimensions();
  const styles = createStyles(theme, windowHeight);
  const [resetKey, setResetKey] = useState(0);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onClose={() => setResetKey(key => key + 1)}>
      <MushafLayoutPanel
        key={resetKey}
        context={props.payload?.context}
        ScrollComponent={ScrollView}
      />
    </ActionSheet>
  );
};

// @ai-end
