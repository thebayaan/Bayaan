import {useEffect, useState} from 'react';
import TrackPlayer, {Capability} from 'react-native-track-player';

export const usePlayerSetup = () => {
  const [isSetupDone, setIsSetupDone] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const setup = async () => {
      try {
        console.log('Setting up TrackPlayer...');
        await TrackPlayer.setupPlayer({
          waitForBuffer: true,
          autoHandleInterruptions: true,
        });
        console.log('TrackPlayer setup complete');

        console.log('Updating TrackPlayer options...');
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
        console.log('TrackPlayer options updated');

        if (!isCancelled) {
          setIsSetupDone(true);
          console.log('Player setup completed successfully');
        }
      } catch (error) {
        console.error('Error setting up the player:', error);
      }
    };

    if (!isSetupDone) {
      setup();
    }

    return () => {
      isCancelled = true;
    };
  }, [isSetupDone]);

  return isSetupDone;
};
