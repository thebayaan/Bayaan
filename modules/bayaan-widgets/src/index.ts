import {NativeBayaanWidgets} from './NativeBayaanWidgets';
import type {WidgetSnapshot} from './snapshot';
import type {WidgetKind} from './widgetKinds';
import type {WidgetContent} from './content';
import type {ContentWidgetKind} from './contentKinds';
import {parseQueuedCommands, type QueuedWidgetCommand} from './commands';
import type {WidgetCatalog} from './catalog';
import {
  EMPTY_ARTWORK_REQUESTS,
  parseArtworkRequests,
  type WidgetArtworkRequests,
} from './artworkRequests';
import {
  isActivityStartResult,
  isNowPlayingActivityState,
  type ActivityStartResult,
  type NowPlayingActivityState,
} from './liveActivity';
import type {AdhkarSessionActivityState} from './adhkarActivity';
import {parsePendingTasbeeh, type PendingTasbeeh} from './tasbeeh';
import {
  parsePendingWidgetEvents,
  type PendingWidgetEvent,
} from './widgetEvents';

export * from './snapshot';
export * from './commands';
export * from './tasbeeh';
export * from './widgetEvents';
export * from './widgetKinds';
export * from './catalog';
export * from './artworkRequests';
export * from './dayMath';
export * from './liveActivity';
export * from './adhkarActivity';
export * from './content';
export * from './contentKinds';
export * from './contextRules';

export function isWidgetsAvailable(): boolean {
  return NativeBayaanWidgets !== null;
}

export function writeSnapshot(snapshot: WidgetSnapshot): void {
  NativeBayaanWidgets?.writeSnapshot(JSON.stringify(snapshot));
}

export function reloadWidgets(
  kinds: ReadonlyArray<WidgetKind | ContentWidgetKind>,
): void {
  if (kinds.length === 0) return;
  NativeBayaanWidgets?.reloadWidgets([...kinds]);
}

export function takeQueuedCommands(): QueuedWidgetCommand[] {
  if (!NativeBayaanWidgets) return [];
  return parseQueuedCommands(NativeBayaanWidgets.takeQueuedCommands());
}

// @ai-start
/** Releases widget taps (iOS intents, Android WidgetCommandActivity) waiting on commands queued up to `through`. */
export function markCommandsHandled(through: number): void {
  NativeBayaanWidgets?.markCommandsHandled?.(through);
}
// @ai-end

export function takePendingTasbeeh(): PendingTasbeeh[] {
  if (!NativeBayaanWidgets) return [];
  return parsePendingTasbeeh(NativeBayaanWidgets.takePendingTasbeeh());
}

export function takePendingWidgetEvents(): PendingWidgetEvent[] {
  if (!NativeBayaanWidgets) return [];
  return parsePendingWidgetEvents(
    NativeBayaanWidgets.takePendingWidgetEvents(),
  );
}

export async function cacheArtwork(
  sourceUrl: string,
  fileName: string,
): Promise<boolean> {
  if (!NativeBayaanWidgets) return false;
  return NativeBayaanWidgets.cacheArtwork(sourceUrl, fileName);
}

export function hasArtwork(fileName: string): boolean {
  return NativeBayaanWidgets?.hasArtwork(fileName) ?? false;
}

export function writeCatalog(catalog: WidgetCatalog): void {
  NativeBayaanWidgets?.writeCatalog(JSON.stringify(catalog));
}

export function writeContent(content: WidgetContent): void {
  NativeBayaanWidgets?.writeContent(JSON.stringify(content));
}

export function readArtworkRequests(): WidgetArtworkRequests {
  if (!NativeBayaanWidgets) return EMPTY_ARTWORK_REQUESTS;
  return parseArtworkRequests(NativeBayaanWidgets.readArtworkRequests());
}

export function addWidgetCommandListener(listener: () => void): {
  remove: () => void;
} {
  if (!NativeBayaanWidgets) return {remove: () => undefined};
  const sub = NativeBayaanWidgets.addListener('onCommandQueued', listener);
  return {remove: () => sub.remove()};
}

export function isLiveActivitySupported(): boolean {
  return NativeBayaanWidgets?.isLiveActivitySupported?.() ?? false;
}

export async function startNowPlayingActivity(
  state: NowPlayingActivityState,
  staleAt: number,
): Promise<ActivityStartResult> {
  const native = NativeBayaanWidgets;
  if (!native?.startNowPlayingActivity) return 'unavailable';
  const result: unknown = await native.startNowPlayingActivity(
    JSON.stringify(state),
    staleAt,
  );
  return isActivityStartResult(result) ? result : 'error';
}

export async function updateNowPlayingActivity(
  state: NowPlayingActivityState,
  staleAt: number,
): Promise<boolean> {
  const native = NativeBayaanWidgets;
  if (!native?.updateNowPlayingActivity) return false;
  return native.updateNowPlayingActivity(JSON.stringify(state), staleAt);
}

/** The activity left on screen by a previous process, or null. */
export function currentNowPlayingActivity(): NowPlayingActivityState | null {
  const json = NativeBayaanWidgets?.currentNowPlayingActivity?.();
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    // Swift's Encodable omits nil optionals; the TS shape wants explicit nulls.
    const normalized: unknown = {artworkFile: null, ayah: null, ...parsed};
    return isNowPlayingActivityState(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export async function endNowPlayingActivities(): Promise<void> {
  const native = NativeBayaanWidgets;
  if (!native?.endNowPlayingActivities) return;
  await native.endNowPlayingActivities();
}

export async function startAdhkarSessionActivity(
  state: AdhkarSessionActivityState,
  staleAt: number,
): Promise<ActivityStartResult> {
  const native = NativeBayaanWidgets;
  if (!native?.startAdhkarSessionActivity) return 'unavailable';
  const result: unknown = await native.startAdhkarSessionActivity(
    JSON.stringify(state),
    staleAt,
  );
  return isActivityStartResult(result) ? result : 'error';
}

export async function updateAdhkarSessionActivity(
  state: AdhkarSessionActivityState,
  staleAt: number,
): Promise<boolean> {
  const native = NativeBayaanWidgets;
  if (!native?.updateAdhkarSessionActivity) return false;
  return native.updateAdhkarSessionActivity(JSON.stringify(state), staleAt);
}

// With dismissAtMs the ended activity stays on screen until that time (it
// is cleared on schedule even if the app is then suspended); without it the
// activity is dismissed at once.
export async function endAdhkarSessionActivities(
  dismissAtMs?: number,
): Promise<void> {
  const native = NativeBayaanWidgets;
  if (!native?.endAdhkarSessionActivities) return;
  await native.endAdhkarSessionActivities(dismissAtMs ?? null);
}
