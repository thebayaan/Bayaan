// services/widgets/enabledWidgets.ts
// Which native widget surfaces this build ships (RFC-021), so the sync code
// can skip work for widgets a fork compiled out or hid from the picker.
import {featureFlags} from '@/config/featureFlags';
import {
  resolveNativeWidgets,
  type NativeWidgetFeatures,
  type NativeWidgetId,
} from '@/config/nativeWidgets';
import nativeWidgetsConfig from '@/config/nativeWidgets.config';

const resolved = resolveNativeWidgets(
  nativeWidgetsConfig.widgets,
  featureFlags,
);
const enabled = new Set<NativeWidgetId>(resolved.enabled);

export const widgetFeatures: Readonly<NativeWidgetFeatures> = resolved.features;

export function isWidgetEnabled(id: NativeWidgetId): boolean {
  return enabled.has(id);
}

// Native reloadWidgets also refreshes the Lock Screen widget and the
// play/pause control when it is sent ContinueListening (they read the same
// snapshot slice), so that kind stays while any of the three ships.
const CONTINUE_LISTENING_READERS: readonly NativeWidgetId[] = [
  'ContinueListening',
  'ListeningAccessory',
  'PlaybackControl',
];

function shipsKind(kind: NativeWidgetId): boolean {
  if (kind === 'ContinueListening') {
    return CONTINUE_LISTENING_READERS.some(id => enabled.has(id));
  }
  return enabled.has(kind);
}

/** The kinds worth reloading, in their original order. */
export function enabledKinds<K extends NativeWidgetId>(
  kinds: readonly K[],
): K[] {
  return kinds.filter(shipsKind);
}
