package expo.modules.bayaanwidgets

import android.content.Context

/**
 * The user-visible app name for widget copy: the application label, which
 * Expo generates from app.config.js `name` (RFC-021).
 */
object AppBrand {
  /** Used only when the label is blank. */
  const val FALLBACK_NAME = "Bayaan"

  fun name(raw: CharSequence?): String = raw?.toString()?.trim()?.takeIf { it.isNotEmpty() } ?: FALLBACK_NAME

  fun name(context: Context): String = name(context.applicationInfo.loadLabel(context.packageManager))
}
