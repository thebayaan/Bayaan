package expo.modules.bayaancar

import android.content.Context

/**
 * The app's display name for car copy: the application label, which Expo
 * generates from app.config.js `name`, so a fork's car UI shows its own
 * name (RFC-021). Loaded when the library service starts.
 */
object CarBrand {
  /** Used until [init] runs or when the label is blank. */
  const val FALLBACK_NAME = "Bayaan"

  @Volatile var name: String = FALLBACK_NAME
    private set

  fun init(context: Context) {
    name = context.applicationInfo.loadLabel(context.packageManager).toString().trim().ifEmpty { FALLBACK_NAME }
  }

  fun unavailableMessage(appName: String = name): String = "Open $appName on your phone to get started"
}
