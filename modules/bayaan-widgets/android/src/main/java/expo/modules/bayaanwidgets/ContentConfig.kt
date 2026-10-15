// main/java/expo/modules/bayaanwidgets/ContentConfig.kt
package expo.modules.bayaanwidgets

import org.json.JSONObject

data class LibraryShelfConfig(val sourceId: String)
data class BedtimeConfig(val surahId: Int, val reciterId: String?, val minutes: Int, val ambient: String?)

/** Phase 3 per-widget configuration, stored under WidgetStorage config.<appWidgetId>. */
object ContentConfigJson {
  const val DEFAULT_BEDTIME_SURAH = 67
  const val DEFAULT_BEDTIME_MINUTES = 30
  val BEDTIME_MINUTES = listOf(15, 30, 45, 60)
  /** Same values as WIDGET_AMBIENT_SOUNDS in commands.ts. */
  val AMBIENT_SOUNDS = listOf("rain", "forest", "ocean", "stream", "thunder", "fireplace", "wind")
  val DEFAULT_BEDTIME = BedtimeConfig(DEFAULT_BEDTIME_SURAH, null, DEFAULT_BEDTIME_MINUTES, null)

  private fun parse(json: String?): JSONObject? = try { json?.let { JSONObject(it) } } catch (e: Exception) { null }

  private fun JSONObject.stringOrNull(key: String): String? =
    if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

  fun decodeLibraryShelf(json: String?): LibraryShelfConfig =
    LibraryShelfConfig(parse(json)?.stringOrNull("sourceId") ?: ContentLogic.DOWNLOADS)

  fun encode(c: LibraryShelfConfig): String = JSONObject().put("sourceId", c.sourceId).toString()

  fun decodeBedtime(json: String?): BedtimeConfig {
    val o = parse(json) ?: return DEFAULT_BEDTIME
    val surah = o.optInt("surahId", DEFAULT_BEDTIME_SURAH).takeIf { it in 1..114 } ?: DEFAULT_BEDTIME_SURAH
    val minutes = o.optInt("minutes", DEFAULT_BEDTIME_MINUTES).takeIf { it in BEDTIME_MINUTES } ?: DEFAULT_BEDTIME_MINUTES
    return BedtimeConfig(surah, o.stringOrNull("reciterId"), minutes, o.stringOrNull("ambient")?.takeIf { it in AMBIENT_SOUNDS })
  }

  fun encode(c: BedtimeConfig): String = JSONObject()
    .put("surahId", c.surahId).put("reciterId", c.reciterId ?: JSONObject.NULL)
    .put("minutes", c.minutes).put("ambient", c.ambient ?: JSONObject.NULL).toString()

  fun ambientLabel(sound: String?): String = sound?.replaceFirstChar { it.uppercase() } ?: "Off"
}
