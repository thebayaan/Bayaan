/**
 * PickerSheet + PickerOptionGrid — RFC-020 shared shell for the composer's
 * value pickers.
 *
 * Deliberately a plain React Native `Modal` following
 * `components/browse/FilterModal.tsx`'s pattern (container/backdrop/header/
 * optionChip styles), NOT a gorhom sheet.
 *
 * `SearchFilters` mounts exactly ONE persistent PickerSheet instance for
 * every sheet (palette + the content-only pickers): `visible` toggles and
 * the children swap. RN's Modal present/dismiss bookkeeping only spans a
 * single instance's `visible` transitions — two separate instances trading
 * places dispatch their iOS transitions independently (the "presentation in
 * progress" wedge class). Content stays lazy: only the active sheet's
 * children render, none while closed.
 */
import React, {useMemo} from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

export interface PickerSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function PickerSheet({
  visible,
  title,
  onClose,
  children,
}: PickerSheetProps) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          accessibilityLabel={`Close ${title}`}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              activeOpacity={0.7}>
              <Feather
                name="x"
                size={moderateScale(24)}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

export interface PickerOption {
  /** Stable value handed to `onSelect` (slug/id/number-as-string). */
  value: string;
  /** Display name — also handed to `onSelect` as the display companion. */
  label: string;
  /** Optional live count (reciters matching this option). */
  count?: number;
}

interface PickerOptionGridProps {
  options: PickerOption[];
  onSelect: (value: string, label: string) => void;
}

/**
 * Flex-wrap grid of single-select option chips (FilterModal's
 * `optionChip*` visual source). Tapping an option fires
 * `onSelect(value, label)` — the caller closes the sheet.
 */
export function PickerOptionGrid({options, onSelect}: PickerOptionGridProps) {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[
        styles.scrollContent,
        {paddingBottom: insets.bottom + moderateScale(24)},
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.optionsContainer}>
        {options.map(option => (
          <TouchableOpacity
            key={option.value}
            style={styles.optionChip}
            onPress={() => onSelect(option.value, option.label)}
            accessibilityRole="button"
            accessibilityLabel={
              option.count !== undefined
                ? `${option.label}, ${option.count} reciters`
                : option.label
            }
            activeOpacity={0.7}>
            <Text style={styles.optionText}>{option.label}</Text>
            {option.count !== undefined ? (
              <Text style={styles.optionCount}>{option.count}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      flex: 1,
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      overflow: 'hidden',
      height: '70%',
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
    body: {
      flex: 1,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: moderateScale(12),
    },
    optionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
    },
    optionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(8),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    optionText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    optionCount: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: Color(theme.colors.textSecondary).alpha(0.6).toString(),
    },
  });
}
