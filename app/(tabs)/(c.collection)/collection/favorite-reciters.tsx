import React, {useRef, useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ReciterItem} from '@/components/ReciterItem';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useRouter} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {ProfileIcon} from '@/components/Icons';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {SearchInput} from '@/components/SearchInput';
import Color from 'color';
import {Reciter} from '@/data/reciterData';
import {SheetManager} from 'react-native-actions-sheet';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
import {USE_GLASS} from '@/hooks/useGlassProps';

export default function FavoriteRecitersScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {favoriteReciters, removeFavorite} = useFavoriteReciters();
  const router = useRouter();

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const renderHeaderRight = useCallback(
    () => (
      <Pressable
        onPress={() => {
          setShowSearch(prev => !prev);
          if (showSearch) setSearchQuery('');
        }}
        hitSlop={8}>
        <Feather
          name="search"
          size={moderateScale(20)}
          color={theme.colors.text}
        />
      </Pressable>
    ),
    [showSearch, theme.colors.text],
  );

  useCollectionNativeHeader({
    title: 'Favorite Reciters',
    scrollY,
    hasContent: favoriteReciters.length > 0,
    headerRight: favoriteReciters.length > 0 ? renderHeaderRight : undefined,
  });

  const filteredReciters = useMemo(
    () =>
      favoriteReciters.filter(reciter =>
        reciter.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [favoriteReciters, searchQuery],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        headerContainer: {
          width: '100%',
          overflow: 'hidden',
        },
        contentArea: {
          width: '100%',
          alignItems: 'center',
          paddingTop: USE_GLASS ? moderateScale(16) : insets.top + moderateScale(40),
          paddingBottom: moderateScale(30),
          overflow: 'hidden',
          backgroundColor: theme.colors.background,
        },
        contentCenter: {
          alignItems: 'center',
          paddingHorizontal: moderateScale(20),
        },
        heroIconContainer: {
          width: moderateScale(64),
          height: moderateScale(64),
          borderRadius: moderateScale(32),
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: moderateScale(12),
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.1)
            .toString(),
        },
        heroIconInner: {
          width: moderateScale(56),
          height: moderateScale(56),
          borderRadius: moderateScale(28),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.08)
            .toString(),
        },
        title: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
          letterSpacing: -0.3,
        },
        subtitle: {
          fontSize: moderateScale(12),
          color: theme.colors.text,
          fontFamily: theme.fonts.regular,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        addBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: moderateScale(12),
          marginHorizontal: moderateScale(16),
          marginTop: moderateScale(8),
          marginBottom: moderateScale(8),
          borderRadius: moderateScale(12),
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
          gap: moderateScale(8),
        },
        addBarText: {
          fontSize: moderateScale(13),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.textSecondary,
        },
        searchBarContainer: {
          paddingHorizontal: moderateScale(16),
          marginBottom: moderateScale(12),
        },
        listContentContainer: {
          flexGrow: 1,
          paddingBottom: moderateScale(65),
        },
        fixedBackButton: {
          position: 'absolute',
          top: insets.top + moderateScale(10),
          left: moderateScale(15),
          zIndex: 5,
          padding: moderateScale(8),
        },
        fixedSearchToggle: {
          position: 'absolute',
          top: insets.top + moderateScale(10),
          right: moderateScale(15),
          zIndex: 5,
          padding: moderateScale(8),
        },
        emptyHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: moderateScale(12),
          paddingHorizontal: moderateScale(16),
        },
        emptyHeaderBack: {
          width: moderateScale(36),
          height: moderateScale(36),
          justifyContent: 'center',
          alignItems: 'center',
        },
        emptyHeaderTitle: {
          flex: 1,
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
        },
        emptyContent: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: moderateScale(32),
          paddingBottom: moderateScale(60),
        },
        emptyIcon: {
          marginBottom: moderateScale(16),
        },
        emptyTitle: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        emptySubtitle: {
          fontSize: moderateScale(13),
          fontFamily: theme.fonts.regular,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          marginBottom: moderateScale(20),
        },
        emptyActionBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: moderateScale(12),
          paddingHorizontal: moderateScale(32),
          borderRadius: moderateScale(12),
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
          gap: moderateScale(8),
        },
        emptyActionText: {
          fontSize: moderateScale(13),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.textSecondary,
        },
      }),
    [theme, insets.top],
  );

  const handleReciterPress = useCallback(
    (reciterId: string) => {
      router.push(`/reciter/${reciterId}`);
    },
    [router],
  );

  const handleOpenSelectReciters = useCallback(() => {
    SheetManager.show('favorite-reciters');
  }, []);

  const handleReciterOptions = useCallback(
    (reciter: Reciter) => {
      SheetManager.show('collection-options', {
        payload: {
          title: reciter.name,
          subtitle: reciter.rewayat[0]?.name || '',
          options: [
            {
              label: 'Remove from Favorites',
              icon: 'user-minus',
              destructive: true,
              onPress: () => removeFavorite(reciter.id),
            },
          ],
        },
      });
    },
    [removeFavorite],
  );

  const renderItem = useCallback(
    ({item}: {item: Reciter}) => (
      <ReciterItem
        item={item}
        onPress={reciter => handleReciterPress(reciter.id)}
        onOptionsPress={handleReciterOptions}
        onLongPress={handleReciterOptions}
      />
    ),
    [handleReciterPress, handleReciterOptions],
  );

  if (favoriteReciters.length === 0) {
    return (
      <View style={styles.container}>
        {!USE_GLASS && (
          <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
            <Pressable
              style={styles.emptyHeaderBack}
              onPress={() => router.back()}
              hitSlop={8}>
              <Feather
                name="arrow-left"
                size={moderateScale(22)}
                color={theme.colors.text}
              />
            </Pressable>
            <Text style={styles.emptyHeaderTitle}>Favorite Reciters</Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <ProfileIcon
              color={theme.colors.textSecondary}
              size={moderateScale(48)}
              filled={true}
            />
          </View>
          <Text style={styles.emptyTitle}>No favorite reciters yet</Text>
          <Text style={styles.emptySubtitle}>
            Add reciters to see them here
          </Text>
          <Pressable
            style={styles.emptyActionBar}
            onPress={handleOpenSelectReciters}>
            <Feather
              name="plus"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyActionText}>Add Reciters</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ListHeaderComponent = () => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.contentArea}>
          <View style={styles.contentCenter}>
            <View style={styles.heroIconContainer}>
              <View style={styles.heroIconInner}>
                <ProfileIcon
                  color={theme.colors.text}
                  size={moderateScale(30)}
                  filled={true}
                />
              </View>
            </View>
            <Text style={styles.title}>Favorite Reciters</Text>
            <Text style={styles.subtitle}>
              {favoriteReciters.length}{' '}
              {favoriteReciters.length === 1 ? 'reciter' : 'reciters'}
            </Text>
          </View>
        </View>

        <Pressable style={styles.addBar} onPress={handleOpenSelectReciters}>
          <Feather
            name="plus"
            size={moderateScale(16)}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.addBarText}>Add Reciters</Text>
        </Pressable>

        {showSearch && (
          <View style={styles.searchBarContainer}>
            <SearchInput
              placeholder="Search favorite reciters"
              value={searchQuery}
              onChangeText={setSearchQuery}
              showCancelButton={false}
              iconColor={theme.colors.text}
              iconOpacity={0.25}
              placeholderTextColor={Color(theme.colors.text)
                .alpha(0.35)
                .toString()}
              textColor={theme.colors.text}
              backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
              borderColor={Color(theme.colors.text).alpha(0.06).toString()}
              containerStyle={{paddingHorizontal: 0}}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!USE_GLASS && (
        <RNAnimated.View
          style={[
            styles.fixedBackButton,
            {
              opacity: scrollY.interpolate({
                inputRange: [80, 120],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      {!USE_GLASS && (
        <RNAnimated.View
          style={[
            styles.fixedSearchToggle,
            {
              opacity: scrollY.interpolate({
                inputRange: [80, 120],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <Pressable
            onPress={() => {
              setShowSearch(prev => !prev);
              if (showSearch) setSearchQuery('');
            }}
            hitSlop={8}>
            <Feather
              name="search"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      <RNAnimated.FlatList
        data={filteredReciters}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      />
      {!USE_GLASS && (
        <CollectionStickyHeader title="Favorite Reciters" scrollY={scrollY} />
      )}
    </View>
  );
}
