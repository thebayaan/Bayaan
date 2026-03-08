import React, {useEffect, useCallback, useRef, useState, useMemo, useLayoutEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  Dimensions,
  ViewToken,
} from 'react-native';
import {useLocalSearchParams, useRouter, useNavigation} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrReader} from '@/components/adhkar/DhikrReader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {Dhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {shortenCategoryTitle} from '@/utils/adhkarUtils';
import {useAdhkarAudioStore} from '@/store/adhkarAudioStore';
import {useAdhkarPlayAllStore} from '@/store/adhkarPlayAllStore';
import {useHeaderHeight} from '@react-navigation/elements';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const DhikrPage = React.memo(function DhikrPage({
  dhikr,
  isSaved,
  onSaveToggle,
}: {
  dhikr: Dhikr;
  isSaved: boolean;
  onSaveToggle: () => void;
}) {
  return (
    <View style={{width: SCREEN_WIDTH, flex: 1}}>
      <DhikrReader
        dhikr={dhikr}
        isSaved={isSaved}
        onSaveToggle={onSaveToggle}
      />
    </View>
  );
});

interface CategoryTitleMap {
  [categoryId: string]: string;
}

const DhikrReaderScreen: React.FC = () => {
  const {
    superId,
    dhikrId,
    globalIndex: globalIndexParam,
    categoryShortTitle: initialCategoryTitle,
    superCategoryTitle,
  } = useLocalSearchParams<{
    superId: string;
    dhikrId: string;
    globalIndex?: string;
    categoryShortTitle?: string;
    superCategoryTitle?: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef<FlatList<Dhikr>>(null);

  const initialIndex = globalIndexParam ? parseInt(globalIndexParam, 10) : 0;

  const [adhkarList, setAdhkarList] = useState<Dhikr[]>([]);
  const [categoryTitles, setCategoryTitles] = useState<CategoryTitleMap>({});
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const {isSaved, toggleSaved} = useAdhkar();

  const setAudio = useAdhkarAudioStore(state => state.setAudio);
  const stopAudio = useAdhkarAudioStore(state => state.stop);

  // Play All store
  const isPlayAllMode = useAdhkarPlayAllStore(state => state.isPlayAllMode);
  const playAllIndex = useAdhkarPlayAllStore(state => state.currentIndex);
  const playAllSourceId = useAdhkarPlayAllStore(state => state.sourceId);
  const goToIndex = useAdhkarPlayAllStore(state => state.goToIndex);

  // Check if this reader is the active Play All source
  const isThisPlayAllSource = isPlayAllMode && playAllSourceId === superId;

  useEffect(() => {
    async function loadData() {
      if (!superId) {
        setIsDataLoaded(true);
        return;
      }

      try {
        const data = await adhkarService.getAdhkarForSuperCategory(superId);
        if (data) {
          const flatAdhkar = data.categoryGroups.flatMap(g => g.adhkar);
          setAdhkarList(flatAdhkar);

          const titlesMap: CategoryTitleMap = {};
          data.categoryGroups.forEach(group => {
            titlesMap[group.categoryId] = shortenCategoryTitle(
              group.categoryTitle,
            );
          });
          setCategoryTitles(titlesMap);
        }
      } catch (error) {
        console.error('Failed to load adhkar data:', error);
      } finally {
        setIsDataLoaded(true);
      }
    }

    loadData();
  }, [superId]);

  const currentDhikr = useMemo(() => {
    return adhkarList[currentIndex] || null;
  }, [adhkarList, currentIndex]);

  useEffect(() => {
    if (currentDhikr) {
      setAudio(currentDhikr.audioFile);
    }
  }, [currentDhikr, setAudio]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  // Sync FlatList scroll when Play All index changes
  const isScrollingFromPlayAll = useRef(false);
  useEffect(() => {
    if (
      isThisPlayAllSource &&
      playAllIndex !== currentIndex &&
      isDataLoaded &&
      adhkarList.length > 0
    ) {
      isScrollingFromPlayAll.current = true;
      flatListRef.current?.scrollToIndex({
        index: playAllIndex,
        animated: true,
      });
      setCurrentIndex(playAllIndex);
      // Reset flag after animation completes
      setTimeout(() => {
        isScrollingFromPlayAll.current = false;
      }, 300);
    }
  }, [
    isThisPlayAllSource,
    playAllIndex,
    currentIndex,
    isDataLoaded,
    adhkarList.length,
  ]);

  const displayTitle = useMemo(() => {
    if (currentDhikr && categoryTitles[currentDhikr.categoryId]) {
      return categoryTitles[currentDhikr.categoryId];
    }
    return initialCategoryTitle || superCategoryTitle || 'Dhikr';
  }, [currentDhikr, categoryTitles, initialCategoryTitle, superCategoryTitle]);

  // Set native header with title + position subtitle
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerTitle: () => (
        <View style={{alignItems: 'center'}}>
          <Text
            style={{
              fontSize: moderateScale(16),
              fontFamily: theme.fonts.semiBold,
              color: theme.colors.text,
            }}
            numberOfLines={1}>
            {displayTitle}
          </Text>
          {adhkarList.length > 1 && (
            <Text
              style={{
                fontSize: moderateScale(12),
                fontFamily: theme.fonts.regular,
                color: theme.colors.textSecondary,
                marginTop: moderateScale(2),
              }}>
              {currentIndex + 1} of {adhkarList.length}
            </Text>
          )}
        </View>
      ),
    });
  }, [navigation, displayTitle, currentIndex, adhkarList.length, theme]);

  const handleSaveToggle = useCallback(
    (dhikr: Dhikr) => {
      toggleSaved(dhikr.id);
    },
    [toggleSaved],
  );

  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        setCurrentIndex(newIndex);

        // Sync Play All store when user manually swipes (not from Play All auto-scroll)
        if (
          isThisPlayAllSource &&
          newIndex !== playAllIndex &&
          !isScrollingFromPlayAll.current
        ) {
          goToIndex(newIndex);
        }
      }
    },
    [isThisPlayAllSource, playAllIndex, goToIndex],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({item}: {item: Dhikr}) => {
      return (
        <DhikrPage
          dhikr={item}
          isSaved={isSaved(item.id)}
          onSaveToggle={() => handleSaveToggle(item)}
        />
      );
    },
    [isSaved, handleSaveToggle],
  );

  const keyExtractor = useCallback((item: Dhikr) => item.id, []);

  if (!dhikrId || !superId) {
    return null;
  }

  if (!isDataLoaded) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, {paddingTop: headerHeight}]}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  if (adhkarList.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, {paddingTop: headerHeight}]}>
          <Text style={styles.emptyText}>No adhkar found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.listContainer, {paddingTop: headerHeight, paddingBottom: insets.bottom}]}>
        <FlatList
          ref={flatListRef}
          data={adhkarList}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          windowSize={3}
          maxToRenderPerBatch={2}
          removeClippedSubviews={true}
          initialNumToRender={1}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="start"
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContainer: {
      flex: 1,
    },
    emptyText: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
  });

export default DhikrReaderScreen;
