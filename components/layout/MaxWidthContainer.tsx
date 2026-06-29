import React from 'react';
import {View, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import {useResponsive} from '@/hooks/useResponsive';

export interface MaxWidthContainerProps {
  /** Hard cap on content width in tablet layouts. Defaults to 720pt. */
  maxWidth?: number;
  /** Wrap in a `flex: 1` filling parent (default true). */
  fill?: boolean;
  /** Optional style merged into the centered inner view. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Centers children in a capped-width column on tablets.
 *
 * On phones this component returns children unchanged (no wrapper view)
 * so it is cost-free for every existing phone screen.
 *
 * On iPad it renders:
 *
 *     View(flex:1, alignItems:'center')
 *       View(flex:1, width:'100%', maxWidth)
 *
 * so lists and scrollviews still layout correctly but never stretch
 * edge-to-edge in landscape.
 */
export const MaxWidthContainer: React.FC<MaxWidthContainerProps> = ({
  maxWidth = 720,
  fill = true,
  style,
  children,
}) => {
  const {isTablet} = useResponsive();

  if (!isTablet) {
    return <>{children}</>;
  }

  return (
    <View style={[fill && styles.outerFill, styles.outerCenter]}>
      <View style={[fill && styles.innerFill, {maxWidth, width: '100%'}, style]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerFill: {
    flex: 1,
  },
  outerCenter: {
    alignItems: 'center',
    width: '100%',
  },
  innerFill: {
    flex: 1,
  },
});
