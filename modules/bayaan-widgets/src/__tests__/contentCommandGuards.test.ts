import {
  isWidgetCommand,
  parseQueuedCommands,
  selectFreshCommands,
} from '../commands';

describe('Phase 3 command guards', () => {
  it('accepts playPlaylist with or without an item', () => {
    expect(
      isWidgetCommand({
        type: 'playPlaylist',
        playlistId: 'playlist_1',
        itemId: 'item_2',
      }),
    ).toBe(true);
    expect(
      isWidgetCommand({
        type: 'playPlaylist',
        playlistId: 'playlist_1',
        itemId: null,
      }),
    ).toBe(true);
    expect(
      isWidgetCommand({type: 'playPlaylist', playlistId: '', itemId: null}),
    ).toBe(false);
    expect(isWidgetCommand({type: 'playPlaylist', playlistId: 'p'})).toBe(
      false,
    );
  });

  // @ai-start
  it('accepts playAdhkar with or without a dhikr', () => {
    expect(
      isWidgetCommand({type: 'playAdhkar', superId: 'morning', dhikrId: 'd1'}),
    ).toBe(true);
    expect(
      isWidgetCommand({type: 'playAdhkar', superId: 'morning', dhikrId: null}),
    ).toBe(true);
    expect(
      isWidgetCommand({type: 'playAdhkar', superId: '', dhikrId: null}),
    ).toBe(false);
    expect(isWidgetCommand({type: 'playAdhkar', superId: 'morning'})).toBe(
      false,
    );
  });
  // @ai-end

  it('accepts startBedtime with valid values only', () => {
    const ok = {
      type: 'startBedtime',
      surahId: 67,
      reciterId: null,
      sleepMinutes: 30,
      ambient: 'rain',
    };
    expect(isWidgetCommand(ok)).toBe(true);
    expect(isWidgetCommand({...ok, ambient: null, reciterId: 'r1'})).toBe(true);
    expect(isWidgetCommand({...ok, ambient: 'waves'})).toBe(false);
    expect(isWidgetCommand({...ok, surahId: 115})).toBe(false);
    expect(isWidgetCommand({...ok, sleepMinutes: 0})).toBe(false);
    expect(isWidgetCommand({...ok, sleepMinutes: 241})).toBe(false);
    expect(isWidgetCommand({...ok, sleepMinutes: 12.5})).toBe(false);
  });

  it('treats the new commands as play commands (last play wins)', () => {
    const queued = parseQueuedCommands(
      JSON.stringify([
        {
          command: {
            type: 'playTrack',
            surahId: 1,
            reciterId: null,
            rewayatId: null,
            ayah: null,
          },
          enqueuedAt: 1,
        },
        {
          command: {
            type: 'startBedtime',
            surahId: 67,
            reciterId: null,
            sleepMinutes: 30,
            ambient: null,
          },
          enqueuedAt: 2,
        },
      ]),
    );
    expect(selectFreshCommands(queued, 3)).toEqual([
      {
        type: 'startBedtime',
        surahId: 67,
        reciterId: null,
        sleepMinutes: 30,
        ambient: null,
      },
    ]);
  });
});
