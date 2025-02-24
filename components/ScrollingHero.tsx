import React, {useMemo, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  InteractionManager,
  ViewStyle,
  ImageStyle,
  TextStyle,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks/useTheme';
import {RECITERS, Reciter} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';
import {reciterImages} from '@/utils/reciterImages';
import {Theme} from '@/utils/themeUtils';

// Error Boundary for ScrollingHero
class ScrollingHeroErrorBoundary extends React.Component<{
  children: React.ReactNode;
}> {
  state = {hasError: false};

  static getDerivedStateFromError() {
    return {hasError: true};
  }

  componentDidCatch(error: Error) {
    console.error('ScrollingHero Error:', error);
  }

  render() {
    if (this.state.hasError) {
      return null; // Render nothing on error
    }
    return this.props.children;
  }
}

interface ColumnConfig {
  speed: number;
  direction: 1 | -1;
  reciters: Reciter[];
  startOffset: number;
}

const COLUMNS: ColumnConfig[] = [
  {speed: 200000, direction: -1, reciters: [], startOffset: 0},
  {speed: 220000, direction: -1, reciters: [], startOffset: 100},
  {speed: 230000, direction: -1, reciters: [], startOffset: 200},
  {speed: 210000, direction: -1, reciters: [], startOffset: 250},
];

// Memoized ReciterImage component
const MemoizedReciterImage = React.memo(ReciterImage, (prev, next) => {
  return (
    prev.reciterName === next.reciterName && prev.imageUrl === next.imageUrl
  );
});

// Optimized reciter distribution with memoization
function useDistributedReciters(reciters: Reciter[]) {
  return useMemo(() => {
    // Create a stable mapping of reciter names
    const reciterImageMap = new Map(
      reciters.map(reciter => [
        reciter,
        reciter.name.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-'),
      ]),
    );

    // Filter reciters with images using the map
    const recitersWithImages = reciters.filter(reciter => {
      const formattedName = reciterImageMap.get(reciter);
      return formattedName && reciterImages[formattedName];
    });

    if (recitersWithImages.length === 0) {
      console.warn('No reciters with images found');
      return Array(5).fill([]);
    }

    // Efficient shuffling algorithm
    function shuffle<T>(array: T[]): T[] {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    let availableReciters = [...recitersWithImages];
    const minRecitersNeeded = 20;
    const maxDuplicates = 5;
    let duplicateCount = 0;

    while (
      availableReciters.length < minRecitersNeeded &&
      duplicateCount < maxDuplicates
    ) {
      availableReciters = [...availableReciters, ...recitersWithImages];
      duplicateCount++;
    }

    const shuffled = shuffle(availableReciters);
    const columns: Reciter[][] = Array(5)
      .fill([])
      .map(() => []);

    shuffled.forEach((reciter, index) => {
      const columnIndex = index % 5;
      if (columns[columnIndex].length < 10) {
        columns[columnIndex].push(reciter);
      }
    });

    return columns;
  }, [reciters]);
}

interface ColumnProps {
  config: ColumnConfig;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}

interface StylesType {
  wrapper: ViewStyle;
  container: ViewStyle;
  columnsContainer: ViewStyle;
  column: ViewStyle;
  imageContainer: ViewStyle;
  image: ImageStyle;
  overlay: ViewStyle;
  contentOverlay: ViewStyle;
  browseButton: ViewStyle;
  buttonText: TextStyle;
}

interface BrowseButtonProps {
  onPress?: () => void;
  theme: Theme;
  styles: StylesType;
}

// Memoize the browse button component
const BrowseButton = React.memo(
  ({onPress, theme, styles}: BrowseButtonProps) => (
    <TouchableOpacity
      style={[styles.browseButton, {backgroundColor: theme.colors.card}]}
      onPress={onPress}
      activeOpacity={0.8}>
      <Text style={[styles.buttonText, {color: theme.colors.text}]}>
        Browse All
      </Text>
    </TouchableOpacity>
  ),
  (prevProps, nextProps) =>
    prevProps.onPress === nextProps.onPress &&
    prevProps.theme === nextProps.theme,
);

BrowseButton.displayName = 'BrowseButton';

interface OverlayProps {
  isRevealed: boolean;
  theme: Theme;
  styles: StylesType;
}

// Memoize the overlay component
const Overlay = React.memo(
  ({isRevealed, theme, styles}: OverlayProps) => (
    <Animated.View
      style={[
        styles.overlay,
        {
          backgroundColor: theme.colors.primary,
          opacity: isRevealed ? 0 : 0.25,
        },
      ]}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.isRevealed === nextProps.isRevealed &&
    prevProps.theme === nextProps.theme,
);

Overlay.displayName = 'Overlay';

// Optimize Column component
const Column = React.memo(
  ({config, styles}: ColumnProps) => {
    const scrollY = useSharedValue(config.startOffset);
    const isAnimating = useSharedValue(true);
    const itemSize = SECTION_HEIGHT / 2;
    const isComponentMounted = React.useRef(true);

    // Create duplicated array for seamless looping
    const duplicatedReciters = useMemo(() => {
      if (config.reciters.length === 0) return [];
      return [...config.reciters, ...config.reciters, ...config.reciters];
    }, [config.reciters]);

    // Calculate content height for a single set of items
    const singleSetHeight = useMemo(
      () => config.reciters.length * (itemSize + moderateScale(4)),
      [config.reciters.length, itemSize],
    );

    // Memoize the animation style
    const animatedStyle = useAnimatedStyle(() => {
      const wrappedPosition = scrollY.value % singleSetHeight;
      return {
        transform: [{translateY: wrappedPosition * config.direction}],
      };
    }, [singleSetHeight, config.direction]);

    React.useEffect(() => {
      if (config.reciters.length === 0) return;

      const startAnimation = () => {
        'worklet';
        scrollY.value = withRepeat(
          withTiming(singleSetHeight, {
            duration: config.speed,
            easing: Easing.linear,
          }),
          -1,
          false,
        );
      };

      const task = InteractionManager.runAfterInteractions(() => {
        if (isAnimating.value && isComponentMounted.current) {
          startAnimation();
        }
      });

      return () => {
        isComponentMounted.current = false;
        isAnimating.value = false;
        cancelAnimation(scrollY);
        scrollY.value = config.startOffset;
        task.cancel();
      };
    }, [
      config.reciters.length,
      singleSetHeight,
      config.speed,
      config.startOffset,
      scrollY,
      isAnimating,
    ]);

    // Memoize visible range calculation
    const getVisibleRange = useCallback(
      (scrollPosition: number) => {
        const wrappedPosition = scrollPosition % singleSetHeight;
        const start = Math.floor(Math.abs(wrappedPosition) / itemSize) - 1;
        const end = start + Math.ceil(SECTION_HEIGHT / itemSize) + 2;
        return {start: Math.max(0, start), end};
      },
      [singleSetHeight, itemSize],
    );

    if (config.reciters.length === 0) return null;

    return (
      <Animated.View style={[styles.column, animatedStyle]}>
        {duplicatedReciters.map((reciter, index) => {
          const {start, end} = getVisibleRange(scrollY.value);

          if (index < start || index > end + config.reciters.length) {
            return (
              <View
                key={`${reciter.id}-${index}`}
                style={styles.imageContainer}
              />
            );
          }

          return (
            <View key={`${reciter.id}-${index}`} style={styles.imageContainer}>
              <MemoizedReciterImage
                imageUrl={reciter.image_url || undefined}
                reciterName={reciter.name}
                style={styles.image}
              />
            </View>
          );
        })}
      </Animated.View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.config === nextProps.config &&
    prevProps.theme === nextProps.theme,
);

Column.displayName = 'Column';

interface ScrollingHeroProps {
  onBrowseAll?: () => void;
}

const SECTION_HEIGHT = moderateScale(200); // Reduced from 400

function createStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      paddingBottom: moderateScale(10),
      paddingHorizontal: moderateScale(10),
    },
    container: {
      height: SECTION_HEIGHT,
      overflow: 'hidden',
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(20),
    },
    columnsContainer: {
      flexDirection: 'row',
      flex: 1,
      gap: moderateScale(4),
    },
    column: {
      flex: 1,
      gap: moderateScale(4),
    },
    imageContainer: {
      aspectRatio: 1,
      width: '100%',
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: moderateScale(4),
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: moderateScale(20),
    },
    contentOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    browseButton: {
      paddingHorizontal: moderateScale(24),
      paddingVertical: moderateScale(12),
      borderRadius: moderateScale(25),
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    buttonText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Bold',
    },
  });
}

export const ScrollingHero = React.memo(
  ({onBrowseAll}: ScrollingHeroProps) => {
    const [isRevealed, setIsRevealed] = useState(false);
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const distributedReciters = useDistributedReciters(RECITERS);
    const columnConfigs = useMemo(
      () =>
        COLUMNS.map((config, index) => ({
          ...config,
          reciters: distributedReciters[index],
        })),
      [distributedReciters],
    );

    const handleReveal = useCallback(() => {
      setIsRevealed(prev => !prev);
    }, []);

    return (
      <ScrollingHeroErrorBoundary>
        <View style={styles.wrapper}>
          <Pressable style={styles.container} onPress={handleReveal}>
            <View style={styles.columnsContainer}>
              {columnConfigs.map((config, index) => (
                <Column
                  key={index}
                  config={config}
                  styles={styles}
                  theme={theme}
                />
              ))}
            </View>
            <Overlay isRevealed={isRevealed} theme={theme} styles={styles} />
            <View style={styles.contentOverlay} pointerEvents="box-none">
              <BrowseButton
                onPress={onBrowseAll}
                theme={theme}
                styles={styles}
              />
            </View>
          </Pressable>
        </View>
      </ScrollingHeroErrorBoundary>
    );
  },
  (prevProps, nextProps) => prevProps.onBrowseAll === nextProps.onBrowseAll,
);

ScrollingHero.displayName = 'ScrollingHero';
