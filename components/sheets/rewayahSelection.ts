// @ai-generated
/**
 * Choosing the mushaf rewayah in the settings picker (and retrying a saved
 * rewayah that failed to load at startup), and choosing the mushaf font,
 * while keeping the settings store and the DigitalKhatt data service in step.
 *
 * The data service switches atomically: a failed switch keeps the previous
 * rewayah intact and rejects with RewayahLoadError; a switch overtaken by a
 * newer tap rejects with RewayahSwitchSupersededError (nothing failed). The
 * store's `rewayah` is what every label shows, so after a failure it is
 * re-aligned with the text the service actually serves.
 */
import {
  digitalKhattDataService,
  isRewayahSwitchSuperseded,
} from '@/services/mushaf/DigitalKhattDataService';
import {
  getShortLabel,
  hasTextData,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {
  rendererPinsHafs,
  useMushafSettingsStore,
  type MushafRenderer,
} from '@/store/mushafSettingsStore';
import {showToast} from '@/utils/toastUtils';

export type RewayahSelectionOutcome =
  /** Nothing to do (already shown, Mushaf 1440, or no bundled text). */
  | {kind: 'unchanged'}
  /** The requested rewayah is now shown and saved. */
  | {kind: 'switched'; rewayah: RewayahId}
  /** Hafs, shown after a startup fallback, is now the saved rewayah. */
  | {kind: 'kept-hafs'}
  /** A newer selection overtook this one; it decides what is shown. */
  | {kind: 'superseded'}
  /** Loading failed; `showing` is still on screen (null: nothing loaded). */
  | {kind: 'failed'; requested: RewayahId; showing: RewayahId | null};

/**
 * Makes the store name the rewayah the data service serves. Only the service
 * knows which text is on screen; the store is what the labels read.
 */
export function reconcileRewayahWithService(): void {
  if (!digitalKhattDataService.initialized) return;
  const served = digitalKhattDataService.rewayah;
  const settings = useMushafSettingsStore.getState();
  if (settings.rewayah !== served) settings.setRewayah(served);
}

export async function selectMushafRewayah(
  value: RewayahId,
): Promise<RewayahSelectionOutcome> {
  const settings = useMushafSettingsStore.getState();
  // Mushaf 1440 pins Hafs, and a rewayah without bundled text cannot load.
  if (rendererPinsHafs(settings.mushafRenderer) || !hasTextData(value)) {
    return {kind: 'unchanged'};
  }
  const alreadyShown =
    value === settings.rewayah &&
    digitalKhattDataService.initialized &&
    digitalKhattDataService.rewayah === value;
  if (alreadyShown) {
    // Tapping the rewayah on screen cancels a switch that is still loading
    // (the latest tap wins); that switch's caller sees it superseded.
    if (digitalKhattDataService.pendingRewayah !== null) {
      await digitalKhattDataService.switchRewayah(value).catch(() => undefined);
    }
    if (value === 'hafs' && settings.rewayahFallbackFrom) {
      settings.clearRewayahFallback();
      return {kind: 'kept-hafs'};
    }
    return {kind: 'unchanged'};
  }
  try {
    await digitalKhattDataService.switchRewayah(value);
  } catch (error) {
    if (isRewayahSwitchSuperseded(error)) return {kind: 'superseded'};
    console.error('[MushafSettings] Failed to switch rewayah:', error);
    reconcileRewayahWithService();
    return {
      kind: 'failed',
      requested: value,
      showing: digitalKhattDataService.initialized
        ? digitalKhattDataService.rewayah
        : null,
    };
  }
  // Never announce a rewayah that is not the one on screen (something newer
  // decided meanwhile); the store keeps naming what is served.
  if (digitalKhattDataService.rewayah !== value) {
    reconcileRewayahWithService();
    return {kind: 'superseded'};
  }
  // The data service already wrote the store when the switch committed;
  // this is a no-op then (and moves IndoPak to a Madani font if needed).
  useMushafSettingsStore.getState().setRewayah(value);
  return {kind: 'switched', rewayah: value};
}

/** Tells the reader what a selection did. */
export function announceRewayahSelection(
  outcome: RewayahSelectionOutcome,
): void {
  switch (outcome.kind) {
    case 'switched':
      showToast('Now reading', getShortLabel(outcome.rewayah));
      return;
    case 'kept-hafs':
      showToast('Now reading', getShortLabel('hafs'));
      return;
    case 'failed':
      showToast(
        `Couldn't load ${getShortLabel(outcome.requested)}`,
        outcome.showing
          ? `Still showing ${getShortLabel(outcome.showing)}.`
          : 'Please try again.',
        'error',
      );
      return;
    default:
      return;
  }
}

/** selectMushafRewayah, then tell the reader the outcome. */
export async function chooseMushafRewayah(
  value: RewayahId,
): Promise<RewayahSelectionOutcome> {
  const outcome = await selectMushafRewayah(value);
  announceRewayahSelection(outcome);
  return outcome;
}

export type RendererSelectionOutcome =
  /** Refused: IndoPak draws Hafs only and another rewayah is shown. */
  | {kind: 'unchanged'}
  /** The font is now `renderer` (for Mushaf 1440, with Hafs shown). */
  | {kind: 'switched'; renderer: MushafRenderer}
  /** A newer font or rewayah tap overtook this one; it decides. */
  | {kind: 'superseded'}
  /** Hafs could not be loaded for Mushaf 1440; font and rewayah stay. */
  | {kind: 'failed'};

// Font taps in order: a tap still waiting for Hafs yields to a later one.
let rendererSelectionSeq = 0;

/**
 * True when the data service serves Hafs, or is about to (initialization
 * loads the store's rewayah), and no switch to another rewayah is loading.
 */
function servesHafsSettled(): boolean {
  const pending = digitalKhattDataService.pendingRewayah;
  if (pending !== null && pending !== 'hafs') return false;
  if (useMushafSettingsStore.getState().rewayah !== 'hafs') return false;
  return (
    !digitalKhattDataService.initialized ||
    digitalKhattDataService.rewayah === 'hafs'
  );
}

/**
 * Makes `value` the mushaf font. Mushaf 1440 draws Hafs only and pins the
 * store to Hafs, so before the pin lands the data service is switched to
 * Hafs through the same switch path as a rewayah tap: a rewayah switch still
 * loading is overtaken (it can never land under the Hafs label), and when
 * Hafs cannot be loaded the font and the rewayah stay as they were.
 */
export async function selectMushafRenderer(
  value: MushafRenderer,
): Promise<RendererSelectionOutcome> {
  const seq = ++rendererSelectionSeq;
  const settings = useMushafSettingsStore.getState();
  // IndoPak draws Hafs only; its row is disabled for other rewayat and the
  // store refuses the pair as well.
  if (value === 'dk_indopak' && settings.rewayah !== 'hafs') {
    return {kind: 'unchanged'};
  }
  const pinsHafs =
    rendererPinsHafs(value) && !rendererPinsHafs(settings.mushafRenderer);
  if (pinsHafs && !servesHafsSettled()) {
    try {
      await digitalKhattDataService.switchRewayah('hafs');
    } catch (error) {
      if (isRewayahSwitchSuperseded(error)) return {kind: 'superseded'};
      console.error('[MushafSettings] Failed to reset rewayah for QCF:', error);
      // The service keeps the rewayah it served; the store names it.
      reconcileRewayahWithService();
      return {kind: 'failed'};
    }
    if (seq !== rendererSelectionSeq) return {kind: 'superseded'};
    useMushafSettingsStore.getState().setRewayah('hafs');
  }
  // The store refuses a font that cannot show the rewayah on screen.
  useMushafSettingsStore.getState().setMushafRenderer(value);
  if (useMushafSettingsStore.getState().mushafRenderer !== value) {
    return {kind: 'unchanged'};
  }
  return {kind: 'switched', renderer: value};
}

/** Tells the reader when a font could not be chosen. */
export function announceRendererSelection(
  outcome: RendererSelectionOutcome,
): void {
  if (outcome.kind === 'failed') {
    showToast("Couldn't switch to Mushaf 1440", 'Please try again.', 'error');
  }
}

/** selectMushafRenderer, then tell the reader about a failure. */
export async function chooseMushafRenderer(
  value: MushafRenderer,
): Promise<RendererSelectionOutcome> {
  const outcome = await selectMushafRenderer(value);
  announceRendererSelection(outcome);
  return outcome;
}
