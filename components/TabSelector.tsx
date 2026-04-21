import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

interface TabSelectorProps<T extends string> {
  options: T[];
  selectedOption: T;
  onSelect: (option: T) => void;
  width?: number;
}

function TabSelector<T extends string>({
  options,
  selectedOption,
  onSelect,
  width,
}: TabSelectorProps<T>) {
  const {theme} = useTheme();
  const selectedIndex = options.indexOf(selectedOption);
  const resolvedWidth = width ?? moderateScale(80 * options.length);

  if (Platform.OS === 'ios') {
    return (
      <SegmentedControl
        values={options}
        selectedIndex={selectedIndex}
        onChange={event => {
          const index = event.nativeEvent.selectedSegmentIndex;
          onSelect(options[index]);
        }}
        style={{
          width: resolvedWidth,
          height: moderateScale(40),
        }}
      />
    );
  }

  // Android: original tab selector with sliding indicator
  const styles = createStyles(theme, options.length, resolvedWidth);

  const indicatorPosition = useRef(
    new Animated.Value(options.indexOf(selectedOption)),
  ).current;

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
      <View style={styles.tabsContainer}>
        {options.map((option, index) => (
          <React.Fragment key={option}>
            <Pressable
              style={styles.tabButton}
              onPress={() => onSelect(option)}>
              <Text
                style={[
                  styles.tabText,
                  selectedOption === option && styles.activeTabText,
                ]}>
                {option}
              </Text>
              {selectedOption === option && (
                <Animated.View style={styles.activeIndicator} />
              )}
            </Pressable>
            {index < options.length - 1 && <View style={styles.separator} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme, _optionCount: number, width: number) =>
  StyleSheet.create({
    container: {
      width,
      height: moderateScale(40),
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
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      textAlign: 'center',
    },
    activeTabText: {
      color: theme.colors.text,
      fontFamily: 'Manrope-Bold',
    },
    separator: {
      width: moderateScale(1),
      height: moderateScale(20),
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      alignSelf: 'center',
    },
    activeIndicator: {
      position: 'absolute',
      bottom: 0,
      width: moderateScale(25),
      height: moderateScale(3),
      backgroundColor: theme.colors.text,
      borderRadius: moderateScale(1.5),
    },
  });

export default TabSelector;
