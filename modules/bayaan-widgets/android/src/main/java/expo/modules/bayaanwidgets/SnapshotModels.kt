package expo.modules.bayaanwidgets

import org.json.JSONObject

data class WidgetTrack(
  val surahId: Int, val surahName: String, val reciterId: String, val reciterName: String,
  val rewayatId: String?, val artworkFile: String?, val isUserUpload: Boolean,
)
data class WidgetNowPlaying(
  val track: WidgetTrack, val isPlaying: Boolean, val positionSec: Double, val durationSec: Double,
  val rate: Double,
)
data class WidgetReciter(val id: String, val name: String, val artworkFile: String?)
data class WidgetLastRead(
  val page: Int, val surahId: Int, val surahName: String, val juz: Int, val openingText: String,
)
data class WidgetTasbeehEntry(val count: Int, val target: Int, val day: String)
data class WidgetSnapshot(
  val version: Int, val generatedAt: Long, val theme: String,
  val nowPlaying: WidgetNowPlaying?, val upNext: List<WidgetTrack>, val recent: List<WidgetTrack>,
  val defaultReciter: WidgetReciter?, val reciterRecents: Map<String, List<WidgetTrack>>,
  val lastRead: WidgetLastRead?, val tasbeeh: Map<String, WidgetTasbeehEntry>,
)

object SnapshotModels {
  const val VERSION = 1

  private fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else getString(key)

  private fun track(o: JSONObject) = WidgetTrack(
    o.getInt("surahId"), o.getString("surahName"), o.getString("reciterId"),
    o.getString("reciterName"), o.optStringOrNull("rewayatId"),
    o.optStringOrNull("artworkFile"), o.getBoolean("isUserUpload"),
  )

  private fun tracks(o: JSONObject, key: String): List<WidgetTrack> {
    val arr = o.getJSONArray(key)
    return (0 until arr.length()).map { track(arr.getJSONObject(it)) }
  }

  /** Returns null for malformed JSON or a different schema version. */
  fun decode(json: String): WidgetSnapshot? = try {
    val o = JSONObject(json)
    if (o.getInt("version") != VERSION) null else {
      val np = if (o.isNull("nowPlaying")) null else o.getJSONObject("nowPlaying").let {
        WidgetNowPlaying(track(it.getJSONObject("track")), it.getBoolean("isPlaying"),
          it.getDouble("positionSec"), it.getDouble("durationSec"), it.getDouble("rate"))
      }
      val dr = if (o.isNull("defaultReciter")) null else o.getJSONObject("defaultReciter").let {
        WidgetReciter(it.getString("id"), it.getString("name"), it.optStringOrNull("artworkFile"))
      }
      val lr = if (o.isNull("lastRead")) null else o.getJSONObject("lastRead").let {
        WidgetLastRead(it.getInt("page"), it.getInt("surahId"), it.getString("surahName"),
          it.getInt("juz"), it.getString("openingText"))
      }
      val rr = o.getJSONObject("reciterRecents")
      val tb = o.getJSONObject("tasbeeh")
      WidgetSnapshot(
        VERSION, o.getLong("generatedAt"), o.getString("theme"), np,
        tracks(o, "upNext"), tracks(o, "recent"), dr,
        rr.keys().asSequence().associateWith { tracks(rr, it) }, lr,
        tb.keys().asSequence().associateWith { k ->
          tb.getJSONObject(k).let { WidgetTasbeehEntry(it.getInt("count"), it.getInt("target"), it.getString("day")) }
        },
      )
    }
  } catch (e: Exception) { null }
}
