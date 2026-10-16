/** A native widget surface. See config/nativeWidgets.js and RFC-021. */
export type NativeWidgetId =
  | 'ContinueListening'
  | 'ContinueReading'
  | 'QuickSurah'
  | 'PinnedReciter'
  | 'AyahOfTheDay'
  | 'Tasbeeh'
  | 'RecentlyPlayed'
  | 'LibraryShelf'
  | 'Bedtime'
  | 'ReciterSpotlight'
  | 'Adhkar'
  | 'BayaanNow'
  // iOS only: Lock Screen widgets, Live Activity, Control Center controls.
  | 'ListeningAccessory'
  | 'VerseOfTheDayAccessory'
  | 'LiveActivity'
  | 'PlaybackControl'
  | 'PlaySurahControl';

/** Flag-driven parts of surfaces that otherwise stay. */
export interface NativeWidgetFeatures {
  /** Bayaan Now's morning and evening adhkar cards. */
  adhkar: boolean;
  /** Bayaan Now's bedtime card. */
  sleepTimer: boolean;
  /** The Bedtime widget's ambient sound option. */
  ambient: boolean;
}

export interface ResolvedNativeWidgets {
  enabled: NativeWidgetId[];
  features: NativeWidgetFeatures;
}

export const NATIVE_WIDGET_IDS: readonly NativeWidgetId[];
export const ANDROID_WIDGET_IDS: readonly NativeWidgetId[];
export const NATIVE_WIDGET_FLAGS: Readonly<
  Partial<Record<NativeWidgetId, readonly string[]>>
>;
export const NATIVE_WIDGET_FEATURES: Readonly<
  Record<keyof NativeWidgetFeatures, string>
>;

export function resolveNativeWidgets(
  widgets: readonly string[] | undefined,
  flags: Readonly<Record<string, boolean>> | undefined,
): ResolvedNativeWidgets;
