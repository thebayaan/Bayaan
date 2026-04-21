import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
} from 'react';
import {View, Text, FlatList, Dimensions, ViewToken} from 'react-native';
import {useLocalSearchParams, useRouter, useNavigation} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrReader} from '@/components/adhkar/DhikrReader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {Dhikr, SavedDhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
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

const SavedDhikrReaderScreen: React.FC = () => {
  const {dhikrId, globalIndex: globalIndexParam} = useLocalSearchParams<{
    dhikrId: string;
    globalIndex?: string;
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
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const {isSaved, toggleSaved, savedIds} = useAdhkar();

  const setAudio = useAdhkarAudioStore(state => state.setAudio);
  const stopAudio = useAdhkarAudioStore(state => state.stop);

  // Play All store
  const isPlayAllMode = useAdhkarPlayAllStore(state => state.isPlayAllMode);
  const playAllIndex = useAdhkarPlayAllStore(state => state.currentIndex);
  const playAllSourceId = useAdhkarPlayAllStore(state => state.sourceId);
  const goToIndex = useAdhkarPlayAllStore(state => state.goToIndex);

  // Check if this reader is the active Play All source
  const isThisPlayAllSource = isPlayAllMode && playAllSourceId === 'saved';

  // Load saved adhkar
  useEffect(() => {
    async function loadData() {
      try {
        const saved = await adhkarService.getSaved();

        // Fetch full dhikr data for each saved item
        const adhkarPromises = saved.map((s: SavedDhikr) =>
          adhkarService.getDhikr(s.dhikrId),
        );
        const adhkarResults = await Promise.all(adhkarPromises);

        // Filter out nulls
        const validAdhkar = adhkarResults.filter((d): d is Dhikr => d !== null);
        setAdhkarList(validAdhkar);
      } catch (error) {
        console.error('Failed to load saved adhkar:', error);
      } finally {
        setIsDataLoaded(true);
      }
    }

    loadData();
  }, []);

  // Update list when saved items change (item unsaved)
  useEffect(() => {
    if (isDataLoaded) {
      // Filter current list to only include items still saved
      setAdhkarList(prev => prev.filter(d => savedIds.has(d.id)));
    }
  }, [savedIds, isDataLoaded]);

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
            }}>
            Saved
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
  }, [navigation, currentIndex, adhkarList.length, theme]);

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

  if (!dhikrId) {
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
          <Text style={styles.emptyText}>No saved adhkar</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.listContainer,
          {paddingTop: headerHeight, paddingBottom: insets.bottom},
        ]}>
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

export default SavedDhikrReaderScreen;
