import React, {useState, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {Theme} from '@/utils/themeUtils';
import {RECITERS} from '@/data/reciterData';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterOptions) => void;
  theme: Theme;
  initialFilters?: FilterOptions;
}

export interface FilterOptions {
  styles: string[];
  rewayat: string[];
  sortBy: 'alphabetical' | 'featured' | 'favorites';
}

// Define the style options
const STYLE_OPTIONS = [
  {label: 'Mojawwad', value: 'mojawwad'},
  {label: 'Molim', value: 'molim'},
  {label: 'Murattal', value: 'murattal'},
];

// Get unique rewayat names from reciters
const getUniqueRewayatNames = () => {
  const rewayatNames = new Set<string>();

  RECITERS.forEach(reciter => {
    reciter.rewayat.forEach(r => {
      if (r.name) {
        rewayatNames.add(r.name);
      }
    });
  });

  // Convert to array and sort alphabetically
  return Array.from(rewayatNames).sort();
};

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      overflow: 'hidden',
      height: '82%', // Fixed height percentage
    },
    innerContent: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
    contentWrapper: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: moderateScale(16),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
      backgroundColor: theme.colors.background,
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    closeButton: {
      padding: moderateScale(10),
      width: moderateScale(44),
      height: moderateScale(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(12),
    },
    sectionTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
      marginBottom: moderateScale(12),
    },
    optionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(8),
    },
    optionChip: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(8),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    optionChipSelected: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    optionText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    optionTextSelected: {
      color: theme.colors.text,
      fontFamily: theme.fonts.medium,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: moderateScale(16),
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.border).alpha(0.1).toString(),
      backgroundColor: theme.colors.background,
    },
    footerContainer: {
      backgroundColor: theme.colors.background,
      position: Platform.OS === 'android' ? 'absolute' : 'relative',
      bottom: Platform.OS === 'android' ? 0 : undefined,
      left: 0,
      right: 0,
      zIndex: 1,
    },
    applyButton: {
      flex: 2,
      backgroundColor: Color(theme.colors.text).alpha(0.9).toString(),
      paddingVertical: moderateScale(12),
      borderRadius: moderateScale(12),
      alignItems: 'center',
    },
    applyButtonText: {
      color: theme.colors.background,
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
    },
    resetButton: {
      flex: 1,
      paddingVertical: moderateScale(12),
      borderRadius: moderateScale(12),
      alignItems: 'center',
      marginRight: moderateScale(8),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.2).toString(),
    },
    resetButtonText: {
      color: theme.colors.text,
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.medium,
    },
  });
}

export default function FilterModal({
  visible,
  onClose,
  onApplyFilters,
  theme,
  initialFilters,
}: FilterModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rewayatNames = useMemo(() => getUniqueRewayatNames(), []);

  const defaultFilters: FilterOptions = {
    styles: [],
    rewayat: [],
    sortBy: 'featured',
  };

  const [filters, setFilters] = useState<FilterOptions>(
    initialFilters || defaultFilters,
  );

  // Update filters when initialFilters changes
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const toggleStyle = (style: string) => {
    console.log('Toggling style:', style);
    setFilters(prev => {
      const isSelected = prev.styles.includes(style);
      console.log('Style is selected:', isSelected);
      if (isSelected) {
        const newStyles = prev.styles.filter(s => s !== style);
        console.log('New styles after removal:', newStyles);
        return {
          ...prev,
          styles: newStyles,
        };
      } else {
        const newStyles = [...prev.styles, style];
        console.log('New styles after addition:', newStyles);
        return {
          ...prev,
          styles: newStyles,
        };
      }
    });
  };

  const toggleRewaya = (rewayaName: string) => {
    setFilters(prev => {
      const isSelected = prev.rewayat.includes(rewayaName);
      if (isSelected) {
        return {
          ...prev,
          rewayat: prev.rewayat.filter(r => r !== rewayaName),
        };
      } else {
        return {
          ...prev,
          rewayat: [...prev.rewayat, rewayaName],
        };
      }
    });
  };

  const handleReset = () => {
    setFilters(defaultFilters);
  };

  const handleApply = () => {
    console.log('Applying filters:', filters);
    onApplyFilters(filters);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity
          style={{flex: 1}}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <View style={styles.innerContent}>
            <View style={styles.contentWrapper}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Filter Reciters</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  activeOpacity={0.7}>
                  <Feather
                    name="x"
                    size={moderateScale(24)}
                    color={theme.colors.text}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={[
                  styles.scrollContent,
                  Platform.OS === 'android' && {
                    paddingBottom: insets.bottom + moderateScale(100),
                  },
                ]}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={Platform.OS === 'android'}
                scrollEventThrottle={16}>
                {/* Recitation Styles */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recitation Styles</Text>
                  <View style={styles.optionsContainer}>
                    {STYLE_OPTIONS.map(style => (
                      <TouchableOpacity
                        key={style.value}
                        style={[
                          styles.optionChip,
                          filters.styles.includes(style.value) &&
                            styles.optionChipSelected,
                        ]}
                        onPress={() => toggleStyle(style.value)}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.optionText,
                            filters.styles.includes(style.value) &&
                              styles.optionTextSelected,
                          ]}>
                          {style.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Rewayat Types */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Rewayat Types</Text>
                  <View style={styles.optionsContainer}>
                    {rewayatNames.map(name => (
                      <TouchableOpacity
                        key={name}
                        style={[
                          styles.optionChip,
                          filters.rewayat.includes(name) &&
                            styles.optionChipSelected,
                        ]}
                        onPress={() => toggleRewaya(name)}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.optionText,
                            filters.rewayat.includes(name) &&
                              styles.optionTextSelected,
                          ]}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View
                style={[
                  styles.footerContainer,
                  {paddingBottom: insets.bottom + moderateScale(30)},
                ]}>
                <View style={styles.footer}>
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={handleReset}
                    activeOpacity={0.7}>
                    <Text style={styles.resetButtonText}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={handleApply}
                    activeOpacity={0.7}>
                    <Text style={styles.applyButtonText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
