import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {View, Text, FlatList, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import {PlayAllButton} from '@/components/adhkar/PlayAllButton';
import {Dhikr, SavedDhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useAdhkarPlayAllStore} from '@/store/adhkarPlayAllStore';
import {TOTAL_BOTTOM_PADDING} from '@/utils/constants';

const SavedAdhkarScreen: React.FC = () => {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleDhikrPress = useCallback(
    (dhikr: Dhikr, index: number) => {
      router.push({
        pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]',
        params: {
          dhikrId: dhikr.id,
          globalIndex: index.toString(),
        },
      });
    },
    [router],
  );

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

  const renderItem = useCallback(
    ({item, index}: {item: Dhikr; index: number}) => (
      <DhikrListItem
        dhikr={item}
        index={index}
        onPress={() => handleDhikrPress(item, index)}
      />
    ),
    [handleDhikrPress],
  );

  const keyExtractor = useCallback((item: Dhikr) => item.id, []);

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
          <Text style={styles.countText}>{adhkarList.length} adhkar</Text>
        </View>
        <PlayAllButton
          onPress={handlePlayAll}
          isPlaying={isSavedPlaying}
          disabled={isLoading || adhkarList.length === 0}
        />
      </View>
    </SafeAreaView>
  );

  if (isLoading) {
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
        <View style={styles.emptyContainer}>
          <Icon
            name="bookmark-outline"
            type="ionicon"
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
      {Header}
      <FlatList
        data={adhkarList}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
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
    countText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
    headerPlaceholder: {
      width: moderateScale(40),
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
      paddingBottom: TOTAL_BOTTOM_PADDING,
    },
  });

export default SavedAdhkarScreen;
