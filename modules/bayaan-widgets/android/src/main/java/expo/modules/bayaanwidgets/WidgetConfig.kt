package expo.modules.bayaanwidgets

import org.json.JSONArray
import org.json.JSONObject

data class QuickSurahConfig(val surahIds: List<Int>, val reciterId: String?)
data class PinnedReciterConfig(val reciterId: String?)
data class TasbeehConfig(val dhikrId: String)

/** Per-widget configuration stored under WidgetStorage config.<appWidgetId>. */
object WidgetConfigJson {
  /** Al-Kahf, Ya-Sin, Al-Mulk, Al-Waqi'ah. */
  val QUICK_SURAH_DEFAULT_IDS = listOf(18, 36, 67, 56)
  /** سُبْحَانَ اللَّهِ وَبِحَمْدِهِ, 100 times. */
  const val DEFAULT_DHIKR_ID = "91"

  private fun parse(json: String?): JSONObject? = try { json?.let { JSONObject(it) } } catch (e: Exception) { null }

  private fun JSONObject.stringOrNull(key: String): String? =
    if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

  fun decodeQuickSurah(json: String?): QuickSurahConfig {
    val o = parse(json)
    val arr = o?.optJSONArray("surahIds")
    val ids = QUICK_SURAH_DEFAULT_IDS.indices.map { i ->
      arr?.optInt(i, 0)?.takeIf { it in 1..114 } ?: QUICK_SURAH_DEFAULT_IDS[i]
    }
    return QuickSurahConfig(ids, o?.stringOrNull("reciterId"))
  }

  fun decodePinnedReciter(json: String?): PinnedReciterConfig = PinnedReciterConfig(parse(json)?.stringOrNull("reciterId"))

  fun decodeTasbeeh(json: String?): TasbeehConfig = TasbeehConfig(parse(json)?.stringOrNull("dhikrId") ?: DEFAULT_DHIKR_ID)

  fun encode(c: QuickSurahConfig): String =
    JSONObject().put("surahIds", JSONArray(c.surahIds)).put("reciterId", c.reciterId ?: JSONObject.NULL).toString()

  fun encode(c: PinnedReciterConfig): String = JSONObject().put("reciterId", c.reciterId ?: JSONObject.NULL).toString()

  fun encode(c: TasbeehConfig): String = JSONObject().put("dhikrId", c.dhikrId).toString()
}
