import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Pressable,
  FlatList,
  ViewToken,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import Animated, {
  ZoomIn,
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks/useTheme';
import {
  hasVersionChanged,
  markVersionAsSeen,
  getLastSeenVersion,
  filterPagesByVersion,
} from '@/utils/versionUtils';
import {ONBOARDING_PAGES, OnboardingPage} from '@/data/onboardingPages';
import OnboardingPageComponent from './OnboardingPage';
import DotIndicator from './DotIndicator';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export interface WhatsNewModalRef {
  show: () => void;
}

export const WhatsNewModal = forwardRef<WhatsNewModalRef>((_, ref) => {
  const {theme} = useTheme();
  const [visible, setVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<OnboardingPage[]>(ONBOARDING_PAGES);
  const flatListRef = useRef<FlatList<OnboardingPage>>(null);
  const scrollX = useSharedValue(0);

  const modalWidth = Math.min(
    SCREEN_WIDTH - moderateScale(48),
    moderateScale(420),
  );
  const pageWidth = modalWidth - moderateScale(64); // account for modal padding

  const isLastPage = currentPage === pages.length - 1;

  useImperativeHandle(ref, () => ({
    show: () => {
      setPages(ONBOARDING_PAGES);
      setCurrentPage(0);
      scrollX.value = 0;
      flatListRef.current?.scrollToOffset({offset: 0, animated: false});
      setVisible(true);
    },
  }));

  useEffect(() => {
    async function checkAndShow() {
      try {
        const versionChanged = await hasVersionChanged();
        if (versionChanged) {
          const lastSeen = await getLastSeenVersion();
          const filtered = filterPagesByVersion(ONBOARDING_PAGES, lastSeen);

          if (filtered.length === 0) return;

          setPages(filtered);
          setTimeout(() => {
            setVisible(true);
          }, 800);
        }
      } catch (error) {
        console.error('[WhatsNewOnboarding] Error checking version:', error);
      }
    }

    checkAndShow();
  }, []);

  function handleClose() {
    setVisible(false);
    markVersionAsSeen();
  }

  function handleNext() {
    if (isLastPage) {
      handleClose();
      return;
    }
    const nextIndex = currentPage + 1;
    flatListRef.current?.scrollToIndex({index: nextIndex, animated: true});
  }

  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentPage(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  const renderItem = useCallback(
    ({item, index}: {item: OnboardingPage; index: number}) => (
      <OnboardingPageComponent
        page={item}
        width={pageWidth}
        isIntroPage={item.id === 'welcome'}
      />
    ),
    [pageWidth],
  );

  const keyExtractor = useCallback((item: OnboardingPage) => item.id, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.backdrop} />

        <Animated.View
          entering={ZoomIn.duration(300).springify()}
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.backgroundSecondary,
              width: modalWidth,
              maxHeight: SCREEN_HEIGHT * 0.72,
            },
          ]}>
          {/* Skip button */}
          <Pressable
            style={styles.skipButton}
            onPress={handleClose}
            hitSlop={12}>
            <Text
              style={[styles.skipText, {color: theme.colors.textSecondary}]}>
              Skip
            </Text>
          </Pressable>

          {/* Pages */}
          <View style={styles.pagesContainer}>
            <Animated.FlatList
              ref={flatListRef as any}
              data={pages}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              horizontal
              pagingEnabled
              snapToInterval={pageWidth}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={getItemLayout}
              bounces={false}
            />
          </View>

          {/* Dot indicator */}
          <DotIndicator
            totalPages={pages.length}
            scrollX={scrollX}
            pageWidth={pageWidth}
          />

          {/* Next / Get Started button */}
          <Pressable
            style={({pressed}) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleNext}>
            <Text
              style={[styles.buttonText, {color: theme.colors.textSecondary}]}>
              {isLastPage ? 'Get Started' : 'Next'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
});

WhatsNewModal.displayName = 'WhatsNewModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    borderRadius: moderateScale(24),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(24),
    paddingHorizontal: moderateScale(32),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 24,
  },
  skipButton: {
    position: 'absolute',
    top: moderateScale(16),
    right: moderateScale(20),
    zIndex: 10,
    padding: moderateScale(4),
  },
  skipText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
  },
  pagesContainer: {
    marginTop: moderateScale(24),
    minHeight: moderateScale(280),
    justifyContent: 'center',
  },
  button: {
    paddingVertical: moderateScale(10),
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
  },
});
