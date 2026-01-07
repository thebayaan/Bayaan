import {
  Animated,
  ViewStyle,
  StyleProp,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';

/**
 * Props for the main ReciterProfile component
 */
export interface ReciterProfileProps {
  /** The ID of the reciter to display */
  id: string;
  /** Whether to show only favorite surahs */
  showFavorites?: boolean;
}

/**
 * Props for the ReciterHeader component
 */
export interface ReciterHeaderProps {
  /** The reciter object containing all reciter information */
  reciter: Reciter;
  /** The currently selected rewayat ID */
  selectedRewayatId?: string;
  /** Handler for when the rewayat style is changed */
  onStyleChange: () => void;
  /** Handler for when the rewayat info button is pressed */
  onRewayatInfoPress: () => void;
  /** Whether the search bar is visible */
  showSearch: boolean;
  /** Safe area insets for proper padding */
  insets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * Props for the StickyHeader component
 */
export interface StickyHeaderProps {
  /** The reciter's name to display */
  reciterName: string;
  /** Animated value for header opacity */
  headerOpacity: Animated.AnimatedInterpolation<number>;
  /** Safe area insets for proper padding */
  insets: {
    top: number;
  };
  /** Dominant colors for gradient effect */
  dominantColors: {
    primary: string;
    secondary: string;
  };
  /** Current theme mode */
  isDarkMode: boolean;
}

/**
 * Props for the SearchHeader component
 */
export interface SearchHeaderProps {
  /** Whether the search bar is visible */
  showSearch: boolean;
  /** Current search query */
  searchQuery: string;
  /** Handler for search query changes */
  onSearchChange: (query: string) => void;
  /** Safe area insets for proper padding */
  insets: {
    top: number;
  };
}

/**
 * Props for the SurahList component
 */
export interface SurahListProps {
  /** List of surahs to display */
  surahs: Surah[];
  /** Handler for when a surah is pressed */
  onSurahPress: (surah: Surah) => void;
  /** The reciter's ID */
  reciterId: string;
  /** Function to check if a surah is loved */
  isLoved: (reciterId: string, surahId: string) => boolean;
  /** Handler for surah options button press */
  onOptionsPress: (surah: Surah) => void;
  /** Scroll event handler */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** List header component */
  ListHeaderComponent: React.ReactElement;
  /** Style for the list container */
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Animation state for the ReciterProfile
 */
export interface AnimationState {
  /** Animated value for scroll position */
  scrollY: Animated.Value;
  /** Animated value for icons opacity */
  iconsOpacity: Animated.Value;
  /** Animated value for icons z-index */
  iconsZIndex: Animated.Value;
  /** Function to animate icons */
  animateIcons: (show: boolean) => void;
}

/**
 * Props for the ActionButtons component
 */
export interface ActionButtonsProps {
  /** Handler for when the favorite button is pressed */
  onFavoritePress: () => void;
  /** Handler for when the shuffle button is pressed */
  onShufflePress: () => void;
  /** Handler for when the play button is pressed */
  onPlayPress: () => void;
  /** Whether the reciter is in the user's favorites */
  isFavoriteReciter: boolean;
}
