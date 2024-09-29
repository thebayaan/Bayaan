import TrackPlayer, {Capability} from 'react-native-track-player';

let isSetup = false;

export const setupTrackPlayer = async () => {
  if (!isSetup) {
    try {
      await TrackPlayer.setupPlayer({
        waitForBuffer: true,
        autoHandleInterruptions: true,
      });
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause],
      });
      isSetup = true;
    } catch (error) {
      console.error('Error setting up TrackPlayer:', error);
    }
  }
};
