import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Slider} from '@miblanchard/react-native-slider';
import {State} from 'react-native-track-player';
import {Icon} from 'react-native-elements';
import {theme} from '@/styles/theme';
import {useAudioPlayerContext} from '@/contexts/AudioPlayerContext';

interface AudioControlsProps {
  playbackState: State;
  togglePlayback: () => void;
  seekForward: () => void;
  seekBackward: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (value: number) => void;
  isPlaying: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  togglePlayback,
  seekForward,
  seekBackward,
  playNext,
  playPrevious,
  seekTo,
  isPlaying,
}) => {
  const {progress} = useAudioPlayerContext();
  const [sliderValue, setSliderValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isSliding, setIsSliding] = useState(false);

  useEffect(() => {
    if (!isSeeking) {
      setSliderValue(progress.position);
    }
  }, [progress.position, isSeeking]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours > 0 ? `${hours}:` : ''}${mins < 10 && hours > 0 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderThumbComponent = () => (
    <View style={[styles.sliderThumb, isSliding && styles.sliderThumbActive]} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.sliderContainer}>
        <Slider
          value={sliderValue}
          minimumValue={0}
          maximumValue={progress.duration}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor={theme.colors.light}
          trackStyle={styles.sliderTrack}
          renderThumbComponent={renderThumbComponent}
          onValueChange={values => {
            const newValue = values[0];
            setSliderValue(newValue);
            setIsSeeking(true);
            setIsSliding(true);
          }}
          onSlidingComplete={values => {
            const newValue = values[0];
            seekTo(newValue);
            setIsSeeking(false);
            setIsSliding(false);
          }}
        />
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(progress.position)}</Text>
          <Text style={styles.timeText}>{formatTime(progress.duration)}</Text>
        </View>
      </View>
      <View style={styles.controlsContainer}>
        <TouchableOpacity onPress={playPrevious}>
          <Icon
            name="play-skip-back-sharp"
            type="ionicon"
            size={30}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={seekBackward}>
          <Icon
            type="material-community"
            name="rewind-15"
            size={30}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.playPauseButton}
          onPress={togglePlayback}>
          <Icon
            {...getIcon(isPlaying ? 'pause' : 'play')}
            containerStyle={styles.playPauseIcon}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={seekForward}>
          <Icon
            type="material-community"
            name="fast-forward-15"
            size={30}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={playNext}>
          <Icon
            name="play-skip-forward-sharp"
            type="ionicon"
            size={30}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getIcon = (name: 'play' | 'pause') => {
  const iconConfig = {
    play: {type: 'foundation', name: 'play', color: theme.colors.background},
    pause: {type: 'foundation', name: 'pause', color: theme.colors.background},
  };

  return {
    ...iconConfig[name],
    color: theme.colors.background,
    size: 40,
    style: name === 'play' ? {marginLeft: 4} : undefined,
  };
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  sliderContainer: {
    width: '100%',
    marginBottom: 5,
    marginTop: -60,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -5,
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    marginHorizontal: 2,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playPauseIcon: {
    alignSelf: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  sliderThumb: {
    width: 10,
    height: 10,
    borderRadius: 7.5,
    backgroundColor: theme.colors.primary,
  },
  sliderThumbActive: {
    width: 15,
    height: 15,
    borderRadius: 10,
  },
  sliderTrack: {
    height: 2,
  },
});
