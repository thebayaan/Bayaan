// @ai-generated
/**
 * Test-only harness of the sheet playback end-to-end tests
 * (VerseActionsSheet.playback.endToEnd.test.tsx on fixture surahs with real
 * timings; VerseActionsSheet.playback.endToEnd.alldbs.test.tsx on every
 * words DB). The test files mock the native edges (expo-audio as a fake
 * player, the main player, the router, the sheet manager, the data
 * services) and run these checks: the real verse actions sheet drives the
 * real mushaf player store and the real timestamp store.
 *
 * For each verse, from the sheet as the mushaf and the player open it:
 *  - mushaf Repeat loops exactly that verse's entry, and the follow-along
 *    band and label are that verse;
 *  - mushaf Play from here starts at that verse's own entry and runs on to
 *    the next verse;
 *  - main player Play from here seeks to that verse's own entry and tracks
 *    the Hafs verses it recites;
 *  - main player Repeat opens the mushaf on exactly that verse (its storage
 *    anchor; Hafs: no anchor, as before) and makes it the pending start.
 * The reciter's timings must be numbered by the rewayah (Hafs: by Hafs), so
 * one verse is one entry.
 *
 * Not imported by app code.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {VerseActionsSheet} from '../VerseActionsSheet';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useTimestampStore} from '@/store/timestampStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {
  registerTimingNumbering,
  type MappedAyahTrackingState,
} from '@/utils/timestampNumbering';
import {verseActionsPayloadForUnits} from '@/store/mushafVerseSelectionStore';
import type {
  RewayahVerseUnits,
  VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {AyahTimestamp} from '@/types/timestamps';

/** The part of the fake expo-audio player the checks drive. */
export interface FakeAudioPlayer {
  currentTime: number;
  listeners: ((status: {didJustFinish: boolean}) => void)[];
}

export interface SheetPlaybackEnv {
  /** The fake expo-audio player created last. */
  player(): FakeAudioPlayer;
  /** Forget the fake players (each playback creates its own). */
  resetPlayers(): void;
  /** The main player's current track and the seeks asked of it. */
  mainPlayer: {
    track: {rewayatId: string; reciterName: string};
    seeks: number[];
  };
  /** Routes pushed through expo-router. */
  routes: unknown[];
}

export interface SheetPlaybackCase {
  rewayah: RewayahId;
  /** The rewayah's verse units (Hafs: its identity units). */
  units: RewayahVerseUnits;
  /** A timing set numbered by the rewayah (Hafs: by Hafs). */
  set: string;
  /** The verses to check, in reading order. */
  verses: readonly VerseUnit[];
}

const st = () => useMushafPlayerStore.getState();

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

type Payload = React.ComponentProps<typeof VerseActionsSheet>['payload'];
const view: {renderer: TestRenderer.ReactTestRenderer | null} = {
  renderer: null,
};

/** Unmounts the sheet left open by the last check. */
export function closeSheet(): void {
  const open = view.renderer;
  view.renderer = null;
  if (open) act(() => open.unmount());
}

async function openSheet(payload: Payload) {
  closeSheet();
  const props = {
    sheetId: 'verse-actions',
    payload,
  } as React.ComponentProps<typeof VerseActionsSheet>;
  await act(async () => {
    view.renderer = TestRenderer.create(<VerseActionsSheet {...props} />);
  });
  await act(async () => {
    await flush();
  });
}

async function press(label: string) {
  const target = view
    .renderer!.root.findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    )
    .pop();
  if (!target) throw new Error(`nothing to press for ${label}`);
  await act(async () => {
    await target.props.onPress();
  });
  // The sheet starts playback without waiting for it.
  await act(async () => {
    await flush();
  });
}

/** Entries heard while the audio runs forward, as "surah:entry". */
async function listen(env: SheetPlaybackEnv, maxSteps: number) {
  const heard: string[] = [];
  for (let i = 0; i < maxSteps && st().playbackState !== 'idle'; i++) {
    const timings = mushafAudioService.getTimestamps();
    if (timings.length === 0) break;
    const surah = mushafAudioService.getCurrentSurah();
    const pos = env.player().currentTime * 1000;
    let idx = -1;
    for (let k = 0; k < timings.length; k++) {
      if (timings[k].timestampFrom <= pos) idx = k;
    }
    if (idx >= 0) heard.push(`${surah}:${timings[idx].ayahNumber}`);
    if (idx === timings.length - 1) {
      env.player().listeners.forEach(l => l({didJustFinish: true}));
      await flush();
      continue;
    }
    // Into the next entry; MushafAudioService polls every 200 ms.
    env.player().currentTime = (timings[idx + 1].timestampFrom + 50) / 1000;
    jest.advanceTimersByTime(200);
    await flush();
  }
  return heard;
}

function resetPlayer(env: SheetPlaybackEnv) {
  st().stop();
  st().setVerseRepeatCount(1);
  st().setRangeRepeatCount(1);
  st().clearRange();
  st().setPendingStart(null);
  env.resetPlayers();
}

/** The payload a mushaf long-press sends for one verse (contract 4.1). */
function mushafPayload(c: SheetPlaybackCase, unit: VerseUnit): Payload {
  return verseActionsPayloadForUnits(c.rewayah, [
    {
      key: unit.key,
      anchor: c.units.hafsAnchor(unit).key,
      hafsKeys: [...unit.hafsKeys],
    },
  ])!;
}

/** Mushaf Repeat and Play from here of every verse; returns the problems. */
export async function checkMushafPlayback(
  c: SheetPlaybackCase,
  env: SheetPlaybackEnv,
): Promise<string[]> {
  const problems: string[] = [];
  for (const unit of c.verses) {
    const next = c.units.next(unit);
    const hasNext = next !== null && next.surah === unit.surah;
    const want = `${unit.surah}:${unit.ayah}`;
    // Repeat: exactly this verse, again and again.
    resetPlayer(env);
    st().setReciter(c.set, 'Test Reciter');
    await openSheet(mushafPayload(c, unit));
    await press('Repeat');
    const looped = await listen(env, 3);
    if (looped.join() !== [want, want, want].join()) {
      problems.push(`${unit.key} Repeat heard [${looped}]`);
    }
    if (st().currentUnitKeys.join() !== unit.key) {
      problems.push(`${unit.key} Repeat band [${st().currentUnitKeys}]`);
    }
    if (st().currentVerseLabel !== unit.key) {
      problems.push(`${unit.key} Repeat label ${st().currentVerseLabel}`);
    }
    // Play from here: from this verse's own entry on.
    resetPlayer(env);
    st().setReciter(c.set, 'Test Reciter');
    await openSheet(mushafPayload(c, unit));
    await press('Play from Here');
    if (st().currentUnitKeys.join() !== unit.key) {
      problems.push(`${unit.key} Play band [${st().currentUnitKeys}]`);
    }
    const heard = await listen(env, 2);
    const expected = hasNext ? [want, `${next!.surah}:${next!.ayah}`] : [want];
    if (heard.slice(0, expected.length).join() !== expected.join()) {
      problems.push(`${unit.key} Play from here heard [${heard}]`);
    }
  }
  resetPlayer(env);
  return problems;
}

/** Main player Play from here and Repeat of every verse; the problems. */
export async function checkMainPlayerPlayback(
  c: SheetPlaybackCase,
  env: SheetPlaybackEnv,
): Promise<string[]> {
  const problems: string[] = [];
  const isHafs = c.rewayah === 'hafs';
  env.mainPlayer.track = {rewayatId: c.set, reciterName: 'Test Reciter'};
  useTimestampStore.setState({supportedRewayatIds: new Set([c.set])} as never);
  let surah = 0;
  let timings: AyahTimestamp[] = [];
  for (const unit of c.verses) {
    if (unit.surah !== surah) {
      // The main player plays this surah: its timings and their numbering,
      // as the follow-along tracker resolves and registers them.
      surah = unit.surah;
      await useTimestampStore.getState().loadTimestampsForSurah(c.set, surah);
      timings = useTimestampStore.getState().currentSurahTimestamps ?? [];
      registerTimingNumbering(
        timings,
        await timingNumberingService.resolve(c.set, surah, timings),
      );
    }
    const anchor = c.units.hafsAnchor(unit);
    // The payload a player verse row sends (contract 4.1).
    const playerPayload = {
      ...mushafPayload(c, unit),
      source: 'player' as const,
    } as Payload;
    env.mainPlayer.seeks.length = 0;
    await openSheet(playerPayload);
    await press('Play from Here');
    const entry = timings.find(e => e.ayahNumber === unit.ayah);
    if (
      !entry ||
      env.mainPlayer.seeks.join() !== String(entry.timestampFrom / 1000)
    ) {
      problems.push(`${unit.key} seeks [${env.mainPlayer.seeks}]`);
    }
    const tracking = useTimestampStore.getState()
      .currentAyah as Partial<MappedAyahTrackingState> | null;
    if (
      tracking?.verseKeys?.join() !== unit.hafsKeys.join() ||
      tracking?.reciterVerseKey !== `${unit.surah}:${unit.ayah}`
    ) {
      problems.push(`${unit.key} tracks ${JSON.stringify(tracking)}`);
    }
    // Repeat from the player: the mushaf opens on exactly this verse.
    env.routes.length = 0;
    resetPlayer(env);
    await openSheet(playerPayload);
    await press('Repeat');
    const route = env.routes[0] as {params?: Record<string, string>};
    const params = route?.params ?? {};
    if (
      params.surah !== String(anchor.surah) ||
      params.ayah !== String(anchor.ayah) ||
      params.anchor !== (isHafs ? undefined : anchor.key)
    ) {
      problems.push(`${unit.key} Repeat opens ${JSON.stringify(params)}`);
    }
    const pending = st().pendingStartUnit;
    if (
      isHafs
        ? pending !== null || st().pendingStartVerseKey !== unit.key
        : pending?.key !== unit.key || pending?.rewayah !== c.rewayah
    ) {
      problems.push(
        `${unit.key} pending start ${JSON.stringify(pending)} / ${st().pendingStartVerseKey}`,
      );
    }
  }
  resetPlayer(env);
  return problems;
}
