import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
} from 'react-native';
import {Icon} from '@rneui/themed';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import Color from 'color';

interface HeaderProps {
  showTranslation?: boolean;
  toggleTranslation?: () => void;
}

// This can be expanded with more menu items in the future
interface MenuItem {
  id: string;
  icon: {name: string; type: string};
  label: string;
  onPress: () => void;
  isActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  showTranslation = false,
  toggleTranslation,
}) => {
  const {theme} = useTheme();
  const {queue, setSheetMode} = useUnifiedPlayer();
  const [showOptions, setShowOptions] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const surahNumber = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const surahGlyph =
    surahNumber && surahGlyphMap[surahNumber]
      ? surahGlyphMap[surahNumber] + surahGlyphMap[0]
      : '';

  // Animation control when menu is toggled
  useEffect(() => {
    if (showOptions) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [showOptions, fadeAnim, scaleAnim]);

  const handleClose = () => {
    setSheetMode('hidden');
  };

  const toggleOptionsMenu = () => {
    setShowOptions(prev => !prev);
  };

  const handleToggleTranslation = () => {
    if (toggleTranslation) {
      toggleTranslation();
      setShowOptions(false);
    }
  };

  // Menu items that can be extended in the future
  const menuItems: MenuItem[] = [
    {
      id: 'translation',
      icon: {name: 'translation', type: 'material-community'},
      label: showTranslation ? 'Hide Translation' : 'Show Translation',
      onPress: handleToggleTranslation,
      isActive: showTranslation,
    },
    // More menu items can be added here in the future
  ];

  return (
    <View style={styles.header}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.closeButton}
        onPress={handleClose}>
        <Icon
          name="chevron-thin-down"
          type="entypo"
          size={moderateScale(22)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
      
      <Text style={[styles.arabicSurahName, {color: theme.colors.text}]}>
        {surahGlyph}
      </Text>

      {toggleTranslation && (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={toggleOptionsMenu}
            activeOpacity={0.7}
            hitSlop={{top: 15, right: 15, bottom: 15, left: 15}}>
            <Icon
              name="dots-vertical"
              type="material-community"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </TouchableOpacity>

          <Modal
            visible={showOptions}
            transparent={true}
            animationType="none"
            onRequestClose={() => setShowOptions(false)}>
            <TouchableWithoutFeedback onPress={() => setShowOptions(false)}>
              <View style={styles.modalOverlay}>
                <Animated.View
                  style={[
                    styles.menuContainer,
                    {
                      backgroundColor: theme.colors.card,
                      opacity: fadeAnim,
                      transform: [{scale: scaleAnim}],
                      top: moderateScale(60),
                      right: moderateScale(15),
                    },
                  ]}>
                  {menuItems.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.menuItem}
                      onPress={item.onPress}
                      activeOpacity={0.7}>
                      <Icon
                        name={item.icon.name}
                        type={item.icon.type}
                        size={moderateScale(18)}
                        color={
                          item.isActive
                            ? theme.colors.primary
                            : theme.colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.menuItemText,
                          {
                            color: item.isActive
                              ? theme.colors.primary
                              : theme.colors.textSecondary,
                          },
                        ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    left: moderateScale(15),
    zIndex: 1,
    padding: moderateScale(10),
    width: moderateScale(44),
    height: moderateScale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  arabicSurahName: {
    fontFamily: 'SurahNames',
    fontSize: moderateScale(24),
  },
  optionsContainer: {
    position: 'absolute',
    right: moderateScale(15),
  },
  optionsButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  menuContainer: {
    position: 'absolute',
    width: moderateScale(200),
    borderRadius: moderateScale(8),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    paddingVertical: moderateScale(6),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    gap: moderateScale(12),
  },
  menuItemText: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-Medium',
  },
});
