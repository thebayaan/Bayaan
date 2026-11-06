// @ai-start
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
 * Disposes Skia objects after the UI thread runs every draw that is already in
 * the worklets UI queue.
 *
 * Use this for an object that a `<Canvas>` renders. Dispose a
 * measurement-only object directly, because no draw ever holds it.
 *
 * The defect: Skia's `redraw()` copies the live object pointers into a
 * recorder and queues the draw with `runOnUI` (`sksg/Container.native.ts`).
 * React can run an effect cleanup before the UI thread drains that queue. A
 * direct `dispose()` then frees an object that a queued draw still holds, and
 * the UI thread aborts with `Attempted to access a disposed object`.
 *
 * The barrier: `runOnUIAsync` pushes onto the same FIFO queue that Skia's
 * `runOnUI` uses (`react-native-worklets/src/threads.native.ts`). The barrier
 * therefore runs after every draw that can still hold the object. A draw
 * queued after the cleanup is safe, because Skia commits the newest rendered
 * tree, which already carries the replacement (or nothing).
 *
 * Limits:
 * - Valid for canvases without animated (shared-value) props. An animated
 *   canvas's mapper can replay the old recorder until the next redraw stops
 *   it.
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

  const disposeAll = () => {
    for (const object of live) {
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
    // Dispose now. This is the pre-fix behaviour.
    disposeAll();
  }
}
// @ai-end
