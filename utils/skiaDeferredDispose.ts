// @ai-start
import {AppState, Platform, type AppStateStatus} from 'react-native';

/**
 * An object that owns Skia native memory and exposes the JSI `dispose()`.
 * `SkParagraph`, `SkImage`, `SkPaint` and `SkFont` all match this shape.
 */
export interface SkiaDisposable {
  dispose: () => void;
}

/**
 * An empty worklet. It captures no value, so nothing crosses the runtime
 * boundary. It occupies one slot in the worklets UI queue and does no work.
 */
const uiQueueBarrier = () => {
  'worklet';
};

/**
 * The most disposals held while the app is away (see
 * `disposeAfterPendingDraws`). Past it, the oldest are let go undisposed, and
 * the garbage collector frees them. That is safe: a recording shares
 * ownership of the paragraphs it draws, so only `dispose()` can free one from
 * under it. The cap bounds what a long background listen can hold.
 */
export const MAX_HELD_DISPOSALS = 1000;

/**
 * Where a disposal goes, on Android (elsewhere this stays unset):
 * - `live`: behind the UI queue, then disposed. The foreground.
 * - `held`: the app is in the background. Held.
 * - `settling`: the app is active again and Fabric is creating the views it
 *   held. Still held, for two frames.
 */
let phase: 'live' | 'held' | 'settling' | undefined;
let held: SkiaDisposable[] = [];
/** Bumped on every change, so a stale wait for frames ends without a flush. */
let settleRun = 0;

/**
 * Disposes Skia objects once no draw can still read them.
 *
 * Use this for an object that a `<Canvas>` renders. Dispose a
 * measurement-only object directly, because no draw ever holds it.
 *
 * React Native Skia records a canvas into a native recording that holds every
 * paragraph it draws, and reads the paragraph when the recording is played:
 * once, when the view takes it (a static canvas), or on every frame (an
 * animated one). See `ParagraphCmd` in `cpp/api/recorder/Drawings.h`. A
 * paragraph disposed before then makes the play throw `Attempted to access a
 * disposed object`. So the dispose waits:
 *
 * - Behind the worklets UI queue. `runOnUIAsync` queues an empty worklet after
 *   the UI-thread work already queued
 *   (`react-native-worklets/src/threads.native.ts`), and the dispose runs once
 *   it has run.
 * - On Android, until the views Fabric held in the background exist. While
 *   the activity is paused, Fabric creates no views. It runs the held mount
 *   items in the first frame after the return. A canvas that mounted
 *   meanwhile has no Skia view, so its recording waits in the Skia view
 *   registry and is played when the view registers, inside that frame
 *   (`registerSkiaView` in `cpp/rnskia/RNSkJsiViewApi.h`). A paragraph
 *   disposed before then throws there, and React Native destroys the React
 *   instance: a blank app, and the audio stops. So every disposal from the
 *   `background` event until two frames after `active` is held, then all of
 *   them go behind the UI queue. On Android a timer (`requestAnimationFrame`
 *   included) fires in a frame's TIMERS_EVENTS step, after the DISPATCH_UI
 *   step that runs the held mount items, and no timer fires while the
 *   activity is paused. iOS creates views in the background, so it never
 *   holds.
 *
 * Limits:
 * - Valid for canvases without animated (shared-value) props. An animated
 *   canvas's recording is played on every frame until the next redraw
 *   replaces it.
 * - On iOS, `IOSUIScheduler::scheduleOnUI` runs a batch at once when the
 *   caller is already on the main thread, and skips the FIFO queue. A barrier
 *   on that path could overtake an earlier batch. This case is unproven.
 */
export function disposeAfterPendingDraws(
  objects: ReadonlyArray<SkiaDisposable | null | undefined>,
): void {
  const live = objects.filter(
    (object): object is SkiaDisposable => object != null,
  );
  if (live.length === 0) {
    return;
  }

  if (Platform.OS === 'android') {
    followAppState();
    if (holding()) {
      hold(live);
      return;
    }
  }
  disposeBehindUiQueue(live);
}

function disposeBehindUiQueue(objects: SkiaDisposable[]): void {
  const disposeAll = () => {
    // The app went to the background while the barrier waited.
    if (holding()) {
      hold(objects);
      return;
    }
    for (const object of objects) {
      try {
        object.dispose();
      } catch {
        // The object is already gone. There is nothing left to free.
      }
    }
  };

  try {
    // Required here, not imported at the top: loading react-native-worklets
    // initializes its native part, which throws where there is none (Jest
    // suites that render Skia text without a worklets mock). The catch below
    // then disposes at once. `require` is synchronous and module-cached.
    const {runOnUIAsync} =
      require('react-native-worklets') as typeof import('react-native-worklets');
    // The promise rejects only when the barrier itself throws on the UI
    // thread, so the earlier draws have run in both cases. If an earlier UI
    // job throws and the rest of its batch is dropped, the barrier never
    // settles: the objects then leak instead of crashing the app.
    runOnUIAsync(uiQueueBarrier).then(disposeAll, disposeAll);
  } catch {
    // The worklets runtime is unavailable, so no UI-thread draw is in flight.
    // Dispose now (unless held). This is the pre-fix behaviour.
    disposeAll();
  }
}

function holding(): boolean {
  return phase === 'held' || phase === 'settling';
}

function hold(objects: SkiaDisposable[]): void {
  held.push(...objects);
  if (held.length > MAX_HELD_DISPOSALS) {
    held.splice(0, held.length - MAX_HELD_DISPOSALS);
  }
}

/** Starts following the app state, at the first disposal. */
function followAppState(): void {
  if (phase !== undefined) {
    return;
  }
  phase = AppState.currentState === 'background' ? 'held' : 'live';
  AppState.addEventListener('change', onAppStateChange);
}

function onAppStateChange(state: AppStateStatus): void {
  if (state === 'background') {
    phase = 'held';
    settleRun++;
    return;
  }
  if (state !== 'active' || phase !== 'held') {
    return;
  }
  phase = 'settling';
  const run = ++settleRun;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (run !== settleRun) {
        return;
      }
      phase = 'live';
      const objects = held;
      held = [];
      if (objects.length > 0) {
        disposeBehindUiQueue(objects);
      }
    });
  });
}
// @ai-end
