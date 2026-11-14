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
  useMushafSettingsStore,
  type MushafRenderer,
} from '@/store/mushafSettingsStore';
import {showToast} from '@/utils/toastUtils';

export type RewayahSelectionOutcome =
  /** Nothing to do (already shown, or no bundled text). */
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
  // A rewayah without bundled text cannot load.
  if (!hasTextData(value)) return {kind: 'unchanged'};
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
  /** The font is now `renderer`. */
  | {kind: 'switched'; renderer: MushafRenderer};

/**
 * Makes `value` the mushaf font. Every font can be chosen with any rewayah
 * but IndoPak, which draws Hafs only (its row is disabled for other rewayat,
 * and the store refuses the pair as well). Mushaf 1440 draws its printed
 * glyphs for Hafs and another rewayah's text in the Madani font.
 */
export async function selectMushafRenderer(
  value: MushafRenderer,
): Promise<RendererSelectionOutcome> {
  const settings = useMushafSettingsStore.getState();
  if (value === 'dk_indopak' && settings.rewayah !== 'hafs') {
    return {kind: 'unchanged'};
  }
  settings.setMushafRenderer(value);
  if (useMushafSettingsStore.getState().mushafRenderer !== value) {
    return {kind: 'unchanged'};
  }
  return {kind: 'switched', renderer: value};
}

/** The font picker's tap (selectMushafRenderer; no outcome needs a toast). */
export const chooseMushafRenderer = selectMushafRenderer;
