package expo.modules.bayaanwidgets

import android.content.Context

/**
 * Flag-driven parts of widgets that otherwise stay (RFC-021). The booleans
 * default to true in this library and are overridden from the app module by
 * plugins/withBayaanWidgets.js, which derives them from config/featureFlags.ts.
 */
object WidgetFeatures {
  /** Bayaan Now's morning and evening adhkar cards. */
  fun adhkar(context: Context): Boolean = context.resources.getBoolean(R.bool.bayaan_widgets_feature_adhkar)

  /** Bayaan Now's bedtime card. */
  fun sleepTimer(context: Context): Boolean = context.resources.getBoolean(R.bool.bayaan_widgets_feature_sleep_timer)

  /** The Bedtime widget's ambient sound option. */
  fun ambient(context: Context): Boolean = context.resources.getBoolean(R.bool.bayaan_widgets_feature_ambient)
}
