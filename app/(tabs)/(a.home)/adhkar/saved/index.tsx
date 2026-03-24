import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import {useRouter, useNavigation, Link} from 'expo-router';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import {PlayAllButton} from '@/components/adhkar/PlayAllButton';
import {Dhikr, SavedDhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useAdhkarPlayAllStore} from '@/store/adhkarPlayAllStore';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useHeaderHeight} from '@react-navigation/elements';
import {USE_GLASS} from '@/hooks/useGlassProps';

const SavedAdhkarScreen: React.FC = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerHeight = useHeaderHeight();
  const bottomInset = useBottomInset();
  const {savedIds} = useAdhkar();

  // Play All store
  const isPlayAllMode = useAdhkarPlayAllStore(state => state.isPlayAllMode);
  const playAllSourceId = useAdhkarPlayAllStore(state => state.sourceId);
  const startPlayAll = useAdhkarPlayAllStore(state => state.startPlayAll);
  const stopPlayAll = useAdhkarPlayAllStore(state => state.stopPlayAll);

  // Check if currently playing saved adhkar
  const isSavedPlaying = isPlayAllMode && playAllSourceId === 'saved';

  const [adhkarList, setAdhkarList] = useState<Dhikr[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved adhkar on mount and when savedIds changes
  useEffect(() => {
    async function loadSavedAdhkar() {
      try {
        setIsLoading(true);
        const saved = await adhkarService.getSaved();

        // Fetch full dhikr data for each saved item
        const adhkarPromises = saved.map((s: SavedDhikr) =>
          adhkarService.getDhikr(s.dhikrId),
        );
        const adhkarResults = await Promise.all(adhkarPromises);

        // Filter out nulls and reverse to show newest first
        const validAdhkar = adhkarResults.filter((d): d is Dhikr => d !== null);
        setAdhkarList(validAdhkar);
      } catch (error) {
        console.error('Failed to load saved adhkar:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSavedAdhkar();
  }, [savedIds.size]); // Reload when saved count changes

  // Play All handler
  const handlePlayAll = useCallback(() => {
    if (isSavedPlaying) {
      // Stop if already playing saved
      stopPlayAll();
      return;
    }

    if (adhkarList.length === 0) return;

    startPlayAll(adhkarList, 0, 'saved', 'saved');

    // Navigate to reader with first dhikr
    const firstDhikr = adhkarList[0];
    router.push({
      pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]',
      params: {
        dhikrId: firstDhikr.id,
        globalIndex: '0',
        playAll: 'true',
      },
    });
  }, [isSavedPlaying, adhkarList, startPlayAll, stopPlayAll, router]);

  // Set native header options dynamically
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTransparent: true,
      headerStyle: {backgroundColor: 'transparent'},
      headerTintColor: theme.colors.text,
      headerShadowVisible: false,
      headerTitleAlign: 'center',
      ...(USE_GLASS
        ? {headerBackButtonDisplayMode: 'minimal', headerBackTitle: ' '}
        : {}),
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
          <Text
            style={{
              fontSize: moderateScale(12),
              fontFamily: theme.fonts.regular,
              color: theme.colors.textSecondary,
              marginTop: moderateScale(2),
            }}>
            {adhkarList.length} adhkar
          </Text>
        </View>
      ),
      headerRight: () => (
        <View style={{paddingHorizontal: moderateScale(4)}}>
          <PlayAllButton
            onPress={handlePlayAll}
            isPlaying={isSavedPlaying}
            disabled={isLoading || adhkarList.length === 0}
          />
        </View>
      ),
    });
  }, [
    navigation,
    adhkarList.length,
    handlePlayAll,
    isSavedPlaying,
    isLoading,
    theme,
  ]);

  const renderItem = useCallback(
    ({item, index}: {item: Dhikr; index: number}) => (
      <Link
        href={{
          pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]',
          params: {
            dhikrId: item.id,
            globalIndex: index.toString(),
          },
        }}
        asChild>
        <Pressable style={StyleSheet.flatten([{flex: 1}])}>
          {USE_GLASS ? (
            <Link.AppleZoom>
              <DhikrListItem dhikr={item} index={index} />
            </Link.AppleZoom>
          ) : (
            <DhikrListItem dhikr={item} index={index} />
          )}
        </Pressable>
      </Link>
    ),
    [],
  );

  const keyExtractor = useCallback((item: Dhikr) => item.id, []);

  if (isLoading) {
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
        <View style={[styles.emptyContainer, {paddingTop: headerHeight}]}>
          <Ionicons
            name="bookmark-outline"
            size={moderateScale(48)}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.emptyText}>No saved adhkar yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the bookmark icon on any dhikr to save it here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={adhkarList}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          {paddingBottom: bottomInset},
        ]}
        contentInset={USE_GLASS ? {top: headerHeight} : undefined}
        contentOffset={
          USE_GLASS ? {x: 0, y: -headerHeight} : undefined
        }
        scrollIndicatorInsets={
          USE_GLASS ? {top: headerHeight} : undefined
        }
        style={
          !USE_GLASS ? {marginTop: headerHeight} : undefined
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: moderateScale(32),
    },
    emptyText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      marginTop: moderateScale(16),
    },
    emptySubtext: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: moderateScale(8),
    },
    listContent: {
      paddingTop: moderateScale(8),
    },
  });

export default SavedAdhkarScreen;
