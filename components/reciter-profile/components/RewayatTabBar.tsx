import React, {useCallback, useState, useRef, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  LayoutChangeEvent,
  Animated as RNAnimated,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';

interface Tab {
  id: string;
  label: string;
}

interface RewayatTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  theme: Theme;
  scrollX: RNAnimated.Value;
  screenWidth: number;
}

export const RewayatTabBar: React.FC<RewayatTabBarProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  theme,
  scrollX,
  screenWidth,
}) => {
  const styles = createStyles(theme);
  const scrollViewRef = useRef<ScrollView>(null);

  const [tabLayouts, setTabLayouts] = useState<
    Map<string, {x: number; width: number}>
  >(new Map());

  const handleTabLayout = useCallback(
    (tabId: string, event: LayoutChangeEvent) => {
      const {x, width} = event.nativeEvent.layout;
      setTabLayouts(prev => {
        const next = new Map(prev);
        next.set(tabId, {x, width});
        return next;
      });
    },
    [],
  );

  const allLayoutsReady = tabLayouts.size === tabs.length && tabs.length > 0;

  // Indicator position + width via translateX + scaleX (native driver)
  const indicatorTranslateX = useMemo(() => {
    if (!allLayoutsReady || tabs.length < 2) {
      if (allLayoutsReady && tabs.length === 1) {
        const layout = tabLayouts.get(tabs[0].id);
        if (layout) {
          const targetLeft = layout.x + layout.width * 0.1;
          const targetWidth = layout.width * 0.8;
          return new RNAnimated.Value(targetLeft + targetWidth / 2);
        }
      }
      return new RNAnimated.Value(0);
    }
    const inputRange = tabs.map((_, i) => i * screenWidth);
    const outputRange = tabs.map(tab => {
      const layout = tabLayouts.get(tab.id);
      if (!layout) return 0;
      const targetLeft = layout.x + layout.width * 0.1;
      const targetWidth = layout.width * 0.8;
      return targetLeft + targetWidth / 2;
    });
    return scrollX.interpolate({inputRange, outputRange, extrapolate: 'clamp'});
  }, [allLayoutsReady, tabs, tabLayouts, scrollX, screenWidth]);

  const indicatorScaleX = useMemo(() => {
    if (!allLayoutsReady || tabs.length < 2) {
      if (allLayoutsReady && tabs.length === 1) {
        const layout = tabLayouts.get(tabs[0].id);
        if (layout) return new RNAnimated.Value(layout.width * 0.8);
      }
      return new RNAnimated.Value(0);
    }
    const inputRange = tabs.map((_, i) => i * screenWidth);
    const outputRange = tabs.map(tab => {
      const layout = tabLayouts.get(tab.id);
      return layout ? layout.width * 0.8 : 0;
    });
    return scrollX.interpolate({inputRange, outputRange, extrapolate: 'clamp'});
  }, [allLayoutsReady, tabs, tabLayouts, scrollX, screenWidth]);

  const handleTabPress = useCallback(
    (tabId: string) => {
      const layout = tabLayouts.get(tabId);
      if (layout && screenWidth > 0) {
        scrollViewRef.current?.scrollTo({
          x: Math.max(0, layout.x + layout.width / 2 - screenWidth / 2),
          animated: true,
        });
      }
      onTabChange(tabId);
    },
    [tabLayouts, screenWidth, onTabChange],
  );

  // Auto-center active tab when it changes
  useEffect(() => {
    const layout = tabLayouts.get(activeTabId);
    if (layout && screenWidth > 0) {
      scrollViewRef.current?.scrollTo({
        x: Math.max(0, layout.x + layout.width / 2 - screenWidth / 2),
        animated: true,
      });
    }
  }, [activeTabId, tabLayouts, screenWidth]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <Pressable
              key={tab.id}
              style={styles.tab}
              onPress={() => handleTabPress(tab.id)}
              onLayout={e => handleTabLayout(tab.id, e)}>
              <Text style={isActive ? styles.tabTextActive : styles.tabText}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        {allLayoutsReady && (
          <RNAnimated.View
            style={[
              styles.indicator,
              {
                width: 1,
                transform: [
                  {translateX: indicatorTranslateX},
                  {scaleX: indicatorScaleX},
                ],
              },
            ]}
          />
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      overflow: 'hidden',
    },
    tabsRow: {
      flexDirection: 'row',
      paddingHorizontal: moderateScale(16),
      gap: moderateScale(4),
    },
    tab: {
      paddingHorizontal: moderateScale(12),
      paddingTop: moderateScale(10),
      paddingBottom: moderateScale(12),
      alignItems: 'center',
    },
    tabText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    indicator: {
      position: 'absolute',
      bottom: moderateScale(2),
      left: 0,
      height: moderateScale(2.5),
      borderRadius: moderateScale(2),
      backgroundColor: theme.colors.text,
    },
  });
