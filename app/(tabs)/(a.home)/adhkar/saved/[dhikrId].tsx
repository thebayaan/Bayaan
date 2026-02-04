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
import {Dhikr, SavedDhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
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

const SavedDhikrReaderScreen: React.FC = () => {
  const {
    dhikrId,
    globalIndex: globalIndexParam,
  } = useLocalSearchParams<{
    dhikrId: string;
    globalIndex?: string;
  }>();

  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const flatListRef = useRef<FlatList<Dhikr>>(null);

  const initialIndex = globalIndexParam ? parseInt(globalIndexParam, 10) : 0;

  const [adhkarList, setAdhkarList] = useState<Dhikr[]>([]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const {isSaved, toggleSaved, savedIds} = useAdhkar();

  const setAudio = useAdhkarAudioStore(state => state.setAudio);
  const stopAudio = useAdhkarAudioStore(state => state.stop);

  // Load saved adhkar
  useEffect(() => {
    async function loadData() {
      try {
        const saved = await adhkarService.getSaved();

        // Fetch full dhikr data for each saved item
        const adhkarPromises = saved.map((s: SavedDhikr) =>
          adhkarService.getDhikr(s.dhikrId)
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

  if (!dhikrId) {
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
          <Text style={styles.headerTitle}>Saved</Text>
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
          <Text style={styles.emptyText}>No saved adhkar</Text>
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

export default SavedDhikrReaderScreen;
