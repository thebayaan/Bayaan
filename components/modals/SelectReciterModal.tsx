import React, {useCallback, useMemo, useState} from 'react';
import {View, Text, Switch, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useReciterStore} from '@/store/reciterStore';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import {getSurahById} from '@/services/dataService';
import {BaseModal} from '@/components/modals/BaseModal';
import {useSettings} from '@/hooks/useSettings';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import Color from 'color';
import BottomSheet from '@gorhom/bottom-sheet';
import {useRouter} from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface SelectReciterModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onClose: () => void;
  surahId: string;
  source?: 'search' | 'home';
}

// Create animated variants of Button component
const AnimatedButton = Animated.createAnimatedComponent(Button);

export const SelectReciterModal: React.FC<SelectReciterModalProps> = ({
  bottomSheetRef,
  onClose,
  surahId,
  source,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const [, setSurahName] = useState<string>('');
  const {playWithReciter, playWithRandomReciter} = useReciterSelection();

  const {askEveryTime, setAskEveryTime, setDefaultReciterSelection} =
    useSettings();
  const router = useRouter();

  // Animation values
  const defaultButtonScale = useSharedValue(1);
  const randomButtonScale = useSharedValue(1);
  const browseButtonScale = useSharedValue(1);

  // Animated styles
  const defaultButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: defaultButtonScale.value}],
  }));

  const randomButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: randomButtonScale.value}],
  }));

  const browseButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: browseButtonScale.value}],
  }));

  React.useEffect(() => {
    const fetchSurahName = async () => {
      if (surahId) {
        const surahIdNumber = parseInt(surahId, 10);
        if (!isNaN(surahIdNumber)) {
          const surah = await getSurahById(surahIdNumber);
          if (surah) {
            setSurahName(surah.name);
          }
        }
      }
    };
    fetchSurahName();
  }, [surahId]);

  const handleUseDefaultReciter = useCallback(async () => {
    if (!surahId || !defaultReciter) return;
    const success = await playWithReciter(defaultReciter, surahId);
    if (success) {
      onClose();
    }
  }, [defaultReciter, surahId, playWithReciter, onClose]);

  const handleUseRandomReciter = useCallback(async () => {
    if (!surahId) return;
    const success = await playWithRandomReciter(surahId);
    if (success) {
      onClose();
    }
  }, [surahId, playWithRandomReciter, onClose]);

  const handleBrowseAllReciters = useCallback(() => {
    if (!surahId) return;

    const route =
      source === 'search'
        ? '/(tabs)/(search)/reciter/browse'
        : '/(tabs)/(home)/reciter/browse';

    onClose();
    setTimeout(() => {
      router.push({
        pathname: route,
        params: {
          view: 'all',
          surahId,
        },
      });
    }, 100);
  }, [surahId, source, onClose, router]);

  const handleReciterSelection = useCallback(
    (action: () => void, selection: string | null) => {
      if (!askEveryTime) {
        setDefaultReciterSelection(selection);
      }
      action();
    },
    [askEveryTime, setDefaultReciterSelection],
  );

  const handleAskEveryTimeToggle = useCallback(() => {
    setAskEveryTime(!askEveryTime);
  }, [askEveryTime, setAskEveryTime]);

  // Animation handlers
  const handleDefaultButtonPressIn = () => {
    defaultButtonScale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handleDefaultButtonPressOut = () => {
    defaultButtonScale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handleRandomButtonPressIn = () => {
    randomButtonScale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handleRandomButtonPressOut = () => {
    randomButtonScale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handleBrowseButtonPressIn = () => {
    browseButtonScale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handleBrowseButtonPressOut = () => {
    browseButtonScale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['40%']}
      onChange={index => {
        if (index === -1) {
          onClose();
        }
      }}>
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          <AnimatedButton
            title="Use Default Reciter"
            style={[styles.defaultButton, defaultButtonAnimatedStyle]}
            textStyle={styles.defaultButtonText}
            onPressIn={handleDefaultButtonPressIn}
            onPressOut={handleDefaultButtonPressOut}
            onPress={() =>
              handleReciterSelection(handleUseDefaultReciter, 'useDefault')
            }>
            <Text style={styles.defaultButtonText}>Use Default Reciter</Text>
          </AnimatedButton>
          <AnimatedButton
            title="Random Reciter"
            style={[styles.button, randomButtonAnimatedStyle]}
            textStyle={styles.buttonText}
            onPressIn={handleRandomButtonPressIn}
            onPressOut={handleRandomButtonPressOut}
            onPress={() =>
              handleReciterSelection(handleUseRandomReciter, 'randomReciter')
            }>
            <Text style={styles.buttonText}>Random Reciter</Text>
          </AnimatedButton>
          <AnimatedButton
            title="Browse All Reciters"
            style={[styles.button, browseButtonAnimatedStyle]}
            textStyle={styles.buttonText}
            onPressIn={handleBrowseButtonPressIn}
            onPressOut={handleBrowseButtonPressOut}
            onPress={() =>
              handleReciterSelection(handleBrowseAllReciters, 'browseAll')
            }>
            <Text style={styles.buttonText}>Browse All Reciters</Text>
          </AnimatedButton>
          <View style={styles.askEveryTimeContainer}>
            <Text style={styles.askEveryTimeText}>Ask every time</Text>
            <Switch
              value={askEveryTime}
              onValueChange={handleAskEveryTimeToggle}
              trackColor={{
                false: Color(theme.colors.border).alpha(0.3).toString(),
                true: Color(theme.colors.text).alpha(0.3).toString(),
              }}
              thumbColor={theme.colors.text}
            />
          </View>
        </View>
      </View>
    </BaseModal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      flex: 1,
      padding: moderateScale(8),
    },
    button: {
      height: moderateScale(48),
      width: '100%',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(30),
      marginTop: moderateScale(8),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      textAlign: 'center',
      color: theme.colors.textSecondary,
    },
    defaultButton: {
      height: moderateScale(48),
      width: '100%',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(30),
      marginTop: moderateScale(8),
      backgroundColor: theme.colors.text,
      justifyContent: 'center',
      alignItems: 'center',
    },
    defaultButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      textAlign: 'center',
      color: theme.colors.background,
    },
    askEveryTimeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      marginTop: moderateScale(16),
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    askEveryTimeText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
    },
  });
