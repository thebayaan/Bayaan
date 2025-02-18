import TrackPlayer, {
  Capability,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import {getLastTrack, getLastPosition} from './trackPersistence';
import {usePlayerStore} from '../store/playerStore';

let isSetup = false;

export const setupTrackPlayer = async () => {
  if (!isSetup) {
    try {
      await TrackPlayer.setupPlayer({
        waitForBuffer: false,
        minBuffer: 15,
        maxBuffer: 50,
        autoHandleInterruptions: true,
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.SpokenAudio,
        iosCategoryOptions: [
          IOSCategoryOptions.AllowAirPlay,
          IOSCategoryOptions.AllowBluetooth,
          IOSCategoryOptions.AllowBluetoothA2DP,
          IOSCategoryOptions.DuckOthers,
        ],
      });

      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
          alwaysPauseOnInterruption: false,
        },
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        progressUpdateEventInterval: 0.5,
        alwaysPauseOnInterruption: true,
      });

      // Restore last played track and position
      const lastTrack = await getLastTrack();
      if (lastTrack) {
        await TrackPlayer.add(lastTrack);
        const lastPosition = await getLastPosition();
        if (lastPosition > 0) {
          await TrackPlayer.seekTo(lastPosition);
        }
        // Don't automatically show the player
        usePlayerStore.getState().setPlayerSheetVisible(false);
      }

      isSetup = true;
    } catch (error) {
      console.error('Error setting up track player:', error);
    }
  }
};
