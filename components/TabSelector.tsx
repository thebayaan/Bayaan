import React, {useEffect, useRef} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

interface TabSelectorProps<T extends string> {
  options: T[];
  selectedOption: T;
  onSelect: (option: T) => void;
}

function TabSelector<T extends string>({
  options,
  selectedOption,
  onSelect,
}: TabSelectorProps<T>) {
  const {theme} = useTheme();
  const styles = createStyles(theme, options.length);

  // Animation for the sliding indicator
  const indicatorPosition = useRef(
    new Animated.Value(options.indexOf(selectedOption)),
  ).current;

  // Update indicator position when selected option changes
  useEffect(() => {
    Animated.spring(indicatorPosition, {
      toValue: options.indexOf(selectedOption),
      tension: 300,
      friction: 30,
      useNativeDriver: true,
    }).start();
  }, [selectedOption, indicatorPosition, options]);

  return (
    <View style={styles.container}>
      {/* Tab buttons */}
      <View style={styles.tabsContainer}>
        {options.map((option, index) => (
          <React.Fragment key={option}>
            <TouchableOpacity
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => onSelect(option)}>
              <Text
                style={[
                  styles.tabText,
                  selectedOption === option && styles.activeTabText,
                ]}>
                {option}
              </Text>
              {selectedOption === option && (
                <>
                  <View />
                  <Animated.View style={styles.activeIndicator} />
                </>
              )}
            </TouchableOpacity>
            {index < options.length - 1 && <View style={styles.separator} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme, optionCount: number) =>
  StyleSheet.create({
    container: {
      width: moderateScale(80 * optionCount),
      height: moderateScale(40),
      alignSelf: 'center',
    },
    tabsContainer: {
      flexDirection: 'row',
      width: '100%',
      height: '100%',
    },
    tabButton: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      paddingHorizontal: moderateScale(5),
    },
    tabText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    activeTabText: {
      color: theme.isDarkMode ? '#FFFFFF' : '#000000',
      fontFamily: 'Manrope-Bold',
    },
    separator: {
      width: moderateScale(1),
      height: moderateScale(20),
      backgroundColor: theme.isDarkMode
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(0, 0, 0, 0.1)',
      alignSelf: 'center',
    },
    activeIndicator: {
      position: 'absolute',
      bottom: 0,
      width: moderateScale(25),
      height: moderateScale(3),
      backgroundColor: theme.isDarkMode ? '#FFFFFF' : '#000000',
      borderRadius: moderateScale(1.5),
    },
  });

export default TabSelector;
