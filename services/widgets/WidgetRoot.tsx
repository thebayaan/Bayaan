// @ai-generated
import React from 'react';
import {BackgroundRoot} from '@/services/audio/BackgroundRoot';

/** AppRegistry name of the headless root WidgetReactRoot (Android) starts. */
export const WIDGET_ROOT_COMPONENT = 'BayaanWidgetRoot';

/** Headless task Android runs from a widget tap until JS has handled it. */
export const WIDGET_KEEP_ALIVE_TASK = 'BayaanWidgetKeepAlive';

/**
 * Headless root that a widget tap starts when the phone app is not open: it
 * boots the app, owns the player and drains the widget command queue, so the
 * tap plays without opening the app.
 */
export function WidgetRoot(): React.JSX.Element | null {
  return <BackgroundRoot id="widget" />;
}
