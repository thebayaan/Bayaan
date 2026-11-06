package expo.modules.bayaanwidgets

import android.content.Context

/**
 * Deep links into the app. The scheme comes from the `bayaan_widgets_url_scheme`
 * string, which plugins/withBayaanWidgets.js generates from app.config.js
 * `scheme` (RFC-021), so a fork with its own scheme gets working widget taps.
 */
object AppLinks {
  /** Used only when the generated string is missing or not a valid scheme. */
  const val FALLBACK_SCHEME = "bayaan"
  private val VALID_SCHEME = Regex("^[A-Za-z][A-Za-z0-9+.-]*$")

  fun scheme(raw: String?): String = raw?.trim()?.takeIf { VALID_SCHEME.matches(it) } ?: FALLBACK_SCHEME

  /** path has no leading slash: "player", "quran/18?ayah=10", or "" for the app root. */
  fun build(scheme: String?, path: String): String = "${scheme(scheme)}://$path"

  fun url(context: Context, path: String): String = build(context.getString(R.string.bayaan_widgets_url_scheme), path)
}
