import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import BottomSheetModal from '@/components/BottomSheetModal';
import {Theme} from '@/utils/themeUtils';

interface PlayerOptionsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const PlayerOptionsModal: React.FC<PlayerOptionsModalProps> = ({
  isVisible,
  onClose,
}) => {
  const {theme} = useTheme();

  const options = [
    {
      label: 'View Reciter',
      icon: 'person',
      onPress: () => {
        /* TODO: Implement View Reciter action */
      },
    },
    {
      label: 'View Surah',
      icon: 'book',
      onPress: () => {
        /* TODO: Implement View Surah action */
      },
    },
    {
      label: 'Share',
      icon: 'share',
      onPress: () => {
        /* TODO: Implement Share action */
      },
    },
    {
      label: 'Download',
      icon: 'download',
      onPress: () => {
        /* TODO: Implement Download action */
      },
    },
  ];

  return (
    <BottomSheetModal
      isVisible={isVisible}
      onClose={onClose}
      snapPoints={['45%']}>
      <View style={styles(theme).container}>
        <Text style={[styles(theme).title, {color: theme.colors.text}]}>
          Options
        </Text>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles(theme).option}
            onPress={option.onPress}>
            <Icon
              name={option.icon}
              type="ionicon"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
            <Text
              style={[styles(theme).optionText, {color: theme.colors.text}]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheetModal>
  );
};

const styles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: moderateScale(16),
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: moderateScale(20),
      fontWeight: 'bold',
      marginBottom: moderateScale(16),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
    },
    optionText: {
      fontSize: moderateScale(16),
      marginLeft: moderateScale(16),
    },
  });

export default PlayerOptionsModal;
