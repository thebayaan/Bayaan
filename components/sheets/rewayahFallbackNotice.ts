// @ai-generated
/**
 * Tells the reader when their saved rewayah could not be loaded at startup.
 *
 * DigitalKhattDataService then shows Hafs and records the fallback in the
 * mushaf settings store (rewayahFallbackFrom). The store keeps the saved
 * rewayah for the next launch, and every label (the mushaf header, the
 * settings picker) reads the store's `rewayah`, so they say Hafs. This toast
 * is the notice at the moment it happens; the mushaf settings show a banner
 * with a retry for as long as the fallback lasts.
 *
 * Installed once at startup by sheets.tsx, which the root layout imports.
 */
import {
  getShortLabel,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {showToast} from '@/utils/toastUtils';

/** Notice copy for a fallback from `from` to Hafs. */
export function rewayahFallbackNotice(from: RewayahId): {
  title: string;
  message: string;
} {
  return {
    title: `Couldn't load ${getShortLabel(from)}`,
    message: 'Showing Hafs instead.',
  };
}

function announce(from: RewayahId): void {
  const {title, message} = rewayahFallbackNotice(from);
  showToast(title, message, 'error');
}

let uninstall: (() => void) | null = null;

/**
 * Shows the fallback toast whenever a fallback starts (also one already in
 * place when this runs). Idempotent; returns a function that removes it.
 */
export function installRewayahFallbackNotice(): () => void {
  if (uninstall) return uninstall;
  const unsubscribe = useMushafSettingsStore.subscribe((state, prev) => {
    const from = state.rewayahFallbackFrom;
    if (from && from !== prev.rewayahFallbackFrom) announce(from);
  });
  const current = useMushafSettingsStore.getState().rewayahFallbackFrom;
  if (current) announce(current);
  uninstall = () => {
    unsubscribe();
    uninstall = null;
  };
  return uninstall;
}
