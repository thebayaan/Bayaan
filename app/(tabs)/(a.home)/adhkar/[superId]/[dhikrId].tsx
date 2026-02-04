import React, {useEffect, useCallback, useRef, useState, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ViewToken,
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrReader} from '@/components/adhkar/DhikrReader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {Dhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {shortenCategoryTitle} from '@/utils/adhkarUtils';
import {useAdhkarAudioStore} from '@/store/adhkarAudioStore';

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
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const flatListRef = useRef<FlatList<Dhikr>>(null);

  const initialIndex = globalIndexParam ? parseInt(globalIndexParam, 10) : 0;

  const [adhkarList, setAdhkarList] = useState<Dhikr[]>([]);
  const [categoryTitles, setCategoryTitles] = useState<CategoryTitleMap>({});
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const {isSaved, toggleSaved} = useAdhkar();

  const setAudio = useAdhkarAudioStore(state => state.setAudio);
  const stopAudio = useAdhkarAudioStore(state => state.stop);

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

  const displayTitle = useMemo(() => {
    if (currentDhikr && categoryTitles[currentDhikr.categoryId]) {
      return categoryTitles[currentDhikr.categoryId];
    }
    return initialCategoryTitle || superCategoryTitle || 'Dhikr';
  }, [currentDhikr, categoryTitles, initialCategoryTitle, superCategoryTitle]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSaveToggle = useCallback(
    (dhikr: Dhikr) => {
      toggleSaved(dhikr.id);
    },
    [toggleSaved],
  );

  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

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

  const totalAdhkar = adhkarList.length;

  const Header = (
    <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={1}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayTitle}
          </Text>
          {totalAdhkar > 1 && (
            <Text style={styles.positionText}>
              {currentIndex + 1} of {totalAdhkar}
            </Text>
          )}
        </View>
        <View style={styles.headerPlaceholder} />
      </View>
    </SafeAreaView>
  );

  if (!isDataLoaded) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.loadingContainer}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  if (adhkarList.length === 0) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>No adhkar found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Header}

      <View style={[styles.listContainer, {paddingBottom: insets.bottom}]}>
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
    headerSafeArea: {
      backgroundColor: theme.colors.background,
    },
    header: {
      height: moderateScale(56),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
    },
    backButton: {
      padding: moderateScale(8),
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    positionText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
    headerPlaceholder: {
      width: moderateScale(40),
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
