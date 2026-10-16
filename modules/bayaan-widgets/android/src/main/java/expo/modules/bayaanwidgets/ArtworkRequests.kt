package expo.modules.bayaanwidgets

import org.json.JSONArray
import org.json.JSONObject

/** Artwork widgets wanted but did not find (artworkRequests.ts). */
data class ArtworkRequests(val surahIds: List<Int>, val reciterIds: List<String>)

/** Mirrors WidgetLogic.mergeRequests on iOS. */
object ArtworkRequestsJson {
  const val MAX_RECITERS = 50

  fun decode(json: String?): ArtworkRequests = try {
    val o = JSONObject(json ?: "{}")
    val s = o.optJSONArray("surahIds") ?: JSONArray()
    val r = o.optJSONArray("reciterIds") ?: JSONArray()
    ArtworkRequests((0 until s.length()).map { s.getInt(it) }, (0 until r.length()).map { r.getString(it) })
  } catch (e: Exception) { ArtworkRequests(emptyList(), emptyList()) }

  fun encode(r: ArtworkRequests): String =
    JSONObject().put("surahIds", JSONArray(r.surahIds)).put("reciterIds", JSONArray(r.reciterIds)).toString()

  /** Valid, unique ids: surah ids sorted ascending, reciter ids in first-seen order (newest 50 kept). */
  fun merge(existing: ArtworkRequests, surahIds: List<Int>, reciterIds: List<String>): ArtworkRequests {
    val surahs = (existing.surahIds + surahIds.filter { it in 1..114 }).distinct().sorted()
    val reciters = existing.reciterIds.toMutableList()
    for (id in reciterIds) if (id.isNotEmpty() && id !in reciters) reciters.add(id)
    return ArtworkRequests(surahs, reciters.takeLast(MAX_RECITERS))
  }
}
