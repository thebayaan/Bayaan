import React, {useState, useEffect} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {useTheme} from '@/hooks/useTheme';

interface PlayButtonProps {
  isPlaying: boolean;
  onPlayPause: () => Promise<void>;
  disabled?: boolean;
}

export const PlayButton: React.FC<PlayButtonProps> = ({
  isPlaying,
  onPlayPause,
  disabled,
}) => {
  const {theme} = useTheme();
  const [optimisticIsPlaying, setOptimisticIsPlaying] = useState(isPlaying);

  // Update optimistic state when actual state changes
  useEffect(() => {
    setOptimisticIsPlaying(isPlaying);
  }, [isPlaying]);

  const handlePress = async () => {
    if (disabled) return;

    // Update optimistic state immediately
    setOptimisticIsPlaying(!optimisticIsPlaying);

    try {
      await onPlayPause();
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticIsPlaying(optimisticIsPlaying);
      console.error('Error toggling play/pause:', error);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({pressed}) => [styles.button, {opacity: pressed ? 0.7 : 1}]}>
      {optimisticIsPlaying ? (
        <PauseIcon color={theme.colors.text} size={moderateScale(24)} />
      ) : (
        <PlayIcon color={theme.colors.text} size={moderateScale(24)} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: moderateScale(40),
    height: moderateScale(40),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(20),
  },
});
