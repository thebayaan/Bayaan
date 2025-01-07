import React, {forwardRef} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import BottomSheet from '@gorhom/bottom-sheet';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {QueueIcon, HeartIcon} from '@/components/Icons';
import {Surah} from '@/data/surahData';

interface SurahActionsBottomSheetProps {
  surah: Surah | null;
  isLoved: boolean;
  onAddToQueue: (surah: Surah) => void;
  onToggleLove: (surah: Surah) => void;
  onClose: () => void;
}

export const SurahActionsBottomSheet = forwardRef<
  BottomSheet,
  SurahActionsBottomSheetProps
>(({surah, isLoved, onAddToQueue, onToggleLove, onClose}, ref) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  if (!surah) return null;

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={['25%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{backgroundColor: theme.colors.background}}>
      <View style={styles.container}>
        <Text style={styles.title}>{`${surah.id}. ${surah.name}`}</Text>
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.action}
          onPress={() => {
            onAddToQueue(surah);
            onClose();
          }}>
          <QueueIcon color={theme.colors.text} size={24} />
          <Text style={styles.actionText}>Add to Queue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.action}
          onPress={() => {
            onToggleLove(surah);
            onClose();
          }}>
          <HeartIcon
            color={isLoved ? theme.colors.primary : theme.colors.text}
            size={24}
            filled={isLoved}
          />
          <Text style={styles.actionText}>
            {isLoved ? 'Remove from Loved' : 'Add to Loved'}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
});

SurahActionsBottomSheet.displayName = 'SurahActionsBottomSheet';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      padding: moderateScale(16),
    },
    title: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(16),
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
    },
    actionText: {
      marginLeft: moderateScale(12),
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
  });
