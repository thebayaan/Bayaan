import TrackPlayer, {Event} from 'react-native-track-player';

const playbackService = async () => {
  console.log('Playback service function called');

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('Remote play event received');
    TrackPlayer.play()
      .then(() => console.log('Play command executed'))
      .catch(error => console.error('Error playing:', error));
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.PlaybackError, async error => {
    console.error('Playback error in service:', error);
    // Optionally, notify the user or take other actions
  });
};

export {playbackService};
