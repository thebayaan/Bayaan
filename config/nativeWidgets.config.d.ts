import type {NativeWidgetId} from './nativeWidgets';

/** Fork seam (RFC-021). See config/nativeWidgets.config.js. */
export interface NativeWidgetsConfig {
  /** The native widget surfaces to ship; undefined ships every surface. */
  widgets?: NativeWidgetId[];
}

declare const nativeWidgetsConfig: NativeWidgetsConfig;
export default nativeWidgetsConfig;
