import {
  isWidgetCommand,
  parseQueuedCommands,
  selectFreshCommands,
  QueuedWidgetCommand,
} from '../commands';

const NOW = 1_791_460_800_000;

describe('isWidgetCommand', () => {
  it('accepts each command shape', () => {
    expect(isWidgetCommand({type: 'setPlayback', playing: true})).toBe(true);
    expect(isWidgetCommand({type: 'setPlayback', playing: false})).toBe(true);
    expect(
      isWidgetCommand({
        type: 'playTrack',
        surahId: 18,
        reciterId: null,
        rewayatId: null,
        ayah: 10,
      }),
    ).toBe(true);
    expect(isWidgetCommand({type: 'playReciter', reciterId: 'r1'})).toBe(true);
  });

  it('rejects unknown types and bad fields', () => {
    expect(isWidgetCommand({type: 'deleteEverything'})).toBe(false);
    expect(
      isWidgetCommand({
        type: 'playTrack',
        surahId: 0,
        reciterId: null,
        rewayatId: null,
        ayah: null,
      }),
    ).toBe(false);
    expect(
      isWidgetCommand({
        type: 'playTrack',
        surahId: 115,
        reciterId: null,
        rewayatId: null,
        ayah: null,
      }),
    ).toBe(false);
    expect(isWidgetCommand({type: 'playReciter', reciterId: ''})).toBe(false);
    expect(isWidgetCommand({type: 'setPlayback'})).toBe(false);
    expect(isWidgetCommand({type: 'setPlayback', playing: 'yes'})).toBe(false);
    expect(isWidgetCommand({type: 'togglePlayback'})).toBe(false);
    expect(isWidgetCommand(null)).toBe(false);
  });
});

describe('parseQueuedCommands', () => {
  it('returns [] for invalid JSON', () => {
    expect(parseQueuedCommands('not json')).toEqual([]);
    expect(parseQueuedCommands('{}')).toEqual([]);
  });

  it('drops malformed entries but keeps valid ones', () => {
    const json = JSON.stringify([
      {command: {type: 'setPlayback', playing: true}, enqueuedAt: NOW},
      {command: {type: 'nope'}, enqueuedAt: NOW},
      {command: {type: 'setPlayback', playing: true}},
    ]);
    expect(parseQueuedCommands(json)).toHaveLength(1);
  });
});

describe('selectFreshCommands', () => {
  it('orders by enqueue time and keeps only the last play command', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'playReciter', reciterId: 'b'}, enqueuedAt: NOW - 1_000},
      {
        command: {type: 'setPlayback', playing: false},
        enqueuedAt: NOW - 61_000,
      },
      {command: {type: 'playReciter', reciterId: 'a'}, enqueuedAt: NOW - 5_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([
      {type: 'playReciter', reciterId: 'b'},
    ]);
  });

  it('drops a stale setPlayback so a fresh one stands alone', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'setPlayback', playing: true}, enqueuedAt: NOW - 61_000},
      {command: {type: 'setPlayback', playing: false}, enqueuedAt: NOW - 1_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([
      {type: 'setPlayback', playing: false},
    ]);
  });

  it('drops a lone stale play command', () => {
    const queued: QueuedWidgetCommand[] = [
      {
        command: {type: 'playReciter', reciterId: 'a'},
        enqueuedAt: NOW - 61_000,
      },
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([]);
  });

  it('honours a custom maxAgeMs', () => {
    const stale: QueuedWidgetCommand[] = [
      {
        command: {type: 'playReciter', reciterId: 'a'},
        enqueuedAt: NOW - 11_000,
      },
    ];
    const fresh: QueuedWidgetCommand[] = [
      {command: {type: 'playReciter', reciterId: 'a'}, enqueuedAt: NOW - 9_000},
    ];
    expect(selectFreshCommands(stale, NOW, 10_000)).toEqual([]);
    expect(selectFreshCommands(fresh, NOW, 10_000)).toEqual([
      {type: 'playReciter', reciterId: 'a'},
    ]);
  });

  it('keeps only the last setPlayback, so rapid taps settle on the final state', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'setPlayback', playing: true}, enqueuedAt: NOW - 3_000},
      {command: {type: 'setPlayback', playing: false}, enqueuedAt: NOW - 2_000},
      {command: {type: 'setPlayback', playing: true}, enqueuedAt: NOW - 1_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([
      {type: 'setPlayback', playing: true},
    ]);
  });

  it('keeps a setPlayback that follows the last play command', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'playReciter', reciterId: 'a'}, enqueuedAt: NOW - 2_000},
      {command: {type: 'setPlayback', playing: false}, enqueuedAt: NOW - 1_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([
      {type: 'playReciter', reciterId: 'a'},
      {type: 'setPlayback', playing: false},
    ]);
  });

  it('drops a setPlayback that precedes the last play command', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'playReciter', reciterId: 'a'}, enqueuedAt: NOW - 3_000},
      {command: {type: 'setPlayback', playing: false}, enqueuedAt: NOW - 2_000},
      {command: {type: 'playReciter', reciterId: 'b'}, enqueuedAt: NOW - 1_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([
      {type: 'playReciter', reciterId: 'b'},
    ]);
  });
});
