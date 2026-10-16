// targets/widgets/Support/WidgetFeatures.swift

/// Flag-driven parts of widgets that otherwise stay (RFC-021).
/// plugins/withBayaanWidgets.js defines BAYAAN_NO_FEATURE_* on this target
/// from config/featureFlags.ts; the default config defines none.
enum WidgetFeatures {
  /// Bayaan Now's morning and evening adhkar cards.
  #if BAYAAN_NO_FEATURE_ADHKAR
  static let adhkar = false
  #else
  static let adhkar = true
  #endif

  /// Bayaan Now's bedtime card.
  #if BAYAAN_NO_FEATURE_SLEEP_TIMER
  static let sleepTimer = false
  #else
  static let sleepTimer = true
  #endif
  // BAYAAN_NO_FEATURE_AMBIENT compiles the Bedtime widget's ambient option out
  // (BedtimeWidget.swift).
}
