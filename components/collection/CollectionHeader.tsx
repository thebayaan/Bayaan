import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {Theme} from '@/utils/themeUtils';

interface CollectionHeaderProps {
  title: string;
  onNewPlaylistPress: () => void;
  onSearchPress: () => void;
  theme: Theme;
}

export const CollectionHeader: React.FC<CollectionHeaderProps> = ({
  title,
  onNewPlaylistPress,
  theme,
}) => {
  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Text style={[styles.title, {color: theme.colors.text}]}>{title}</Text>

      <View style={styles.actions}>
        {/* <TouchableOpacity
          style={styles.actionButton}
          onPress={onSearchPress}
          activeOpacity={0.7}>
          <Icon
            name="search"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity> */}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onNewPlaylistPress}
          activeOpacity={0.7}>
          <Icon
            name="plus"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(16),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: moderateScale(8),
    marginLeft: moderateScale(8),
  },
});
