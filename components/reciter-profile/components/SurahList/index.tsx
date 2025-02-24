import React from 'react';
import {Text, Animated} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {SurahListProps} from '@/types/reciter-profile';
import {SurahItem} from '@/components/SurahItem';
import {Surah} from '@/data/surahData';

/**
 * SurahList component for the ReciterProfile
 *
 * This component displays the list of surahs with their metadata
 * and handles scroll events for the sticky header animation.
 *
 * @component
 */
export const SurahList = React.forwardRef<Animated.FlatList, SurahListProps>(
  (
    {
      surahs,
      onSurahPress,
      reciterId,
      isLoved,
      onOptionsPress,
      onScroll,
      ListHeaderComponent,
      contentContainerStyle,
    },
    ref,
  ) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    const renderItem = React.useCallback(
      ({item}: {item: Surah}) => (
        <SurahItem
          item={item}
          onPress={onSurahPress}
          reciterId={reciterId}
          isLoved={isLoved(reciterId, item.id.toString())}
          onOptionsPress={onOptionsPress}
        />
      ),
      [onSurahPress, reciterId, isLoved, onOptionsPress],
    );

    return (
      <Animated.FlatList
        ref={ref}
        bounces={false}
        showsVerticalScrollIndicator={false}
        data={surahs}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={ListHeaderComponent}
        onScroll={onScroll}
        scrollEventThrottle={1}
        contentContainerStyle={[
          styles.listContentContainer,
          contentContainerStyle,
        ]}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No surahs available</Text>
        }
      />
    );
  },
);

// Add display name
SurahList.displayName = 'SurahList';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    listContentContainer: {
      paddingBottom: moderateScale(80),
    },
    emptyText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: moderateScale(20),
    },
  });
