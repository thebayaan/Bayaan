import React from 'react';
import {View, Text} from 'react-native';
import {TrackPlayerState} from '../../services/TrackPlayerService';
import {AudioControls} from './AudioControls';
import {StyleSheet} from 'react-native';

interface AudioPlayerUIProps {
  isPlayerReady: boolean;
  signedAudioUrl: string | null;
  errorMessage: string | null;
  playbackState: TrackPlayerState;
  progress: {
    position: number;
    duration: number;
  };
  togglePlayback: () => Promise<void>;
  seekTo: (value: number) => Promise<void>;
  seekForward: () => Promise<void>;
  seekBackward: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  isPlaying: boolean;
}

export const AudioPlayerUI: React.FC<AudioPlayerUIProps> = ({
  errorMessage,
  playbackState,
  togglePlayback,
  seekTo,
  seekForward,
  seekBackward,
  playNext,
  playPrevious,
  isPlaying,
}) => {
  if (errorMessage) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.playerContainer}>
      <AudioControls
        playbackState={playbackState}
        togglePlayback={togglePlayback}
        seekTo={seekTo}
        seekForward={seekForward}
        seekBackward={seekBackward}
        playNext={playNext}
        playPrevious={playPrevious}
        isPlaying={isPlaying}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
