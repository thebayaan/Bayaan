import TrackPlayer, {Event, State} from 'react-native-track-player';

export async function playbackService() {
  // Basic Controls
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    TrackPlayer.skipToNext(),
  );
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    TrackPlayer.skipToPrevious(),
  );

  // Jump Forward/Backward
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async () => {
    const position = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(position + 15);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async () => {
    const position = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(Math.max(0, position - 15));
  });

  // Seek
  TrackPlayer.addEventListener(Event.RemoteSeek, ({position}) => {
    TrackPlayer.seekTo(position);
  });

  // Handle audio interruptions
  TrackPlayer.addEventListener(Event.RemoteDuck, async event => {
    if (event.permanent) {
      await TrackPlayer.pause();
    } else {
      if (event.paused) {
        await TrackPlayer.pause();
      } else {
        const playerState = await TrackPlayer.getState();
        if (playerState !== State.Playing) {
          await TrackPlayer.play();
        }
      }
    }
  });
}
