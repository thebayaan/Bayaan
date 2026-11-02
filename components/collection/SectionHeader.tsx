import React from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {Theme} from '@/utils/themeUtils';
// @ai-start
import {latinLetterSpacing} from '@/utils/rtl';
// @ai-end

interface SectionHeaderProps {
  title: string;
  onViewToggle?: () => void;
  isGridView?: boolean;
  theme: Theme;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  onViewToggle,
  isGridView = false,
  theme,
}) => {
  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {/* <Text style={[styles.title, {color: theme.colors.textSecondary}]}>{title}</Text> */}

      {onViewToggle && (
        <Pressable style={styles.toggleButton} onPress={onViewToggle}>
          <Feather
            name={isGridView ? 'list' : 'grid'}
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
      )}
    </View>
  );
};

// @ai-start
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
  },
  title: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: latinLetterSpacing(0.5),
  },
  toggleButton: {
    padding: moderateScale(4),
  },
});
// @ai-end
