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

// @ai-start
/**
 * `screenLayout` for a tab stack: centers every screen in a capped column on
 * tablets, except `fullWidthRoutes`. Grids and shelves go in that list so
 * they take the whole pane and add columns (ipad-standards §5.3). Phones get
 * every screen unchanged.
 */
export function capScreensExcept(
  fullWidthRoutes: readonly string[],
  maxWidth?: number,
) {
  // eslint-disable-next-line react/display-name
  return ({
    route,
    children,
  }: {
    route: {name: string};
    children: React.ReactElement;
  }): React.ReactElement =>
    fullWidthRoutes.includes(route.name) ? (
      children
    ) : (
      <MaxWidthContainer maxWidth={maxWidth}>{children}</MaxWidthContainer>
    );
}
// @ai-end

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
