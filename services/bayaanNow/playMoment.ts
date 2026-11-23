// @ai-generated
// Plays a Bayaan Now card through the paths the widget and CarPlay already
// use, so a card plays the same way on every surface:
//  - a surah: the widget's playTrack command;
//  - bedtime: the Bedtime widget's startBedtime (surah plus sleep timer);
//  - adhkar: the Adhkar widget's play button;
//  - a system playlist: CarPlay's playlist request.
import type {NowMoment} from './moments';

export async function playMoment(moment: NowMoment): Promise<void> {
  switch (moment.kind) {
    case 'surah': {
      const {handleWidgetCommand} =
        require('@/services/widgets/handleWidgetCommand') as typeof import('@/services/widgets/handleWidgetCommand');
      await handleWidgetCommand({
        type: 'playTrack',
        surahId: moment.surahId,
        reciterId: moment.reciterId,
        rewayatId: moment.rewayatId,
        ayah: null,
      });
      return;
    }
    case 'bedtime': {
      const {defaultDeps, playSurah} =
        require('@/services/widgets/handleWidgetCommand') as typeof import('@/services/widgets/handleWidgetCommand');
      const {runContentCommand} =
        require('@/services/widgets/contentCommands') as typeof import('@/services/widgets/contentCommands');
      const deps = defaultDeps();
      await runContentCommand(
        {
          type: 'startBedtime',
          surahId: moment.surahId,
          reciterId: moment.reciterId,
          sleepMinutes: moment.sleepMinutes,
          ambient: null,
        },
        (reciter, surahId) =>
          playSurah(reciter, surahId, moment.rewayatId, null, deps),
      );
      return;
    }
    case 'adhkar': {
      const {playAdhkarFromWidget} =
        require('@/services/adhkar/playback/widgetPlay') as typeof import('@/services/adhkar/playback/widgetPlay');
      await playAdhkarFromWidget(moment.superId, null);
      return;
    }
    case 'playlist': {
      const {executeCarRequest} =
        require('@/services/car/CarPlaybackBridge') as typeof import('@/services/car/CarPlaybackBridge');
      await executeCarRequest({
        kind: 'playlist',
        playlistId: moment.playlistId,
        system: true,
      });
      return;
    }
  }
}
