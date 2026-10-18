// main/java/expo/modules/bayaanwidgets/ContentModels.kt
package expo.modules.bayaanwidgets

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class WidgetShelfItem(
  val surahId: Int, val surahName: String, val reciterId: String, val reciterName: String,
  val rewayatId: String?, val itemId: String?,
)
data class WidgetPlaylist(val id: String, val name: String, val itemCount: Int, val items: List<WidgetShelfItem>)
data class WidgetSpotlightReciter(val id: String, val name: String, val artworkFile: String, val surahIds: List<Int>)
data class WidgetContent(
  val generatedAt: Long, val downloads: List<WidgetShelfItem>, val downloadCount: Int,
  val playlists: List<WidgetPlaylist>, val spotlight: List<WidgetSpotlightReciter>, val sleepTimerEndsAt: Long?,
) {
  fun playlist(id: String): WidgetPlaylist? = playlists.firstOrNull { it.id == id }
}

data class FeaturedDhikr(val id: String, val arabic: String, val translation: String?, val repeatCount: Int)
data class SessionDhikr(
  val id: String, val translation: String?, val repeatCount: Int, val audioFile: String?,
  val mediumText: String, val mediumCut: Boolean, val largeText: String, val largeCut: Boolean,
)
data class AdhkarPeriodData(
  val period: String, val superId: String, val title: String, val arabicTitle: String, val count: Int,
  val featured: List<FeaturedDhikr>, val items: List<SessionDhikr>,
)
data class AdhkarPeriods(val morning: AdhkarPeriodData, val evening: AdhkarPeriodData) {
  fun of(period: AdhkarPeriod): AdhkarPeriodData = if (period == AdhkarPeriod.MORNING) morning else evening
}

/** Decoders for content.json (content.ts) and the generated adhkar data. */
object ContentModels {
  const val VERSION = 1

  private fun JSONObject.stringOrNull(key: String): String? = if (!has(key) || isNull(key)) null else getString(key)
  private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
  private fun JSONArray.ints(): List<Int> = (0 until length()).map { getInt(it) }

  private fun item(o: JSONObject) = WidgetShelfItem(
    o.getInt("surahId"), o.getString("surahName"), o.getString("reciterId"), o.getString("reciterName"),
    o.stringOrNull("rewayatId"), o.stringOrNull("itemId"),
  )

  /** Null for malformed JSON or another version. */
  fun decodeContent(json: String): WidgetContent? = try {
    val o = JSONObject(json)
    if (o.getInt("version") != VERSION) null else WidgetContent(
      o.getLong("generatedAt"),
      o.getJSONArray("downloads").objects().map(::item),
      o.getInt("downloadCount"),
      o.getJSONArray("playlists").objects().map { p ->
        WidgetPlaylist(p.getString("id"), p.getString("name"), p.getInt("itemCount"), p.getJSONArray("items").objects().map(::item))
      },
      o.getJSONArray("spotlight").objects().map { s ->
        WidgetSpotlightReciter(s.getString("id"), s.getString("name"), s.getString("artworkFile"), s.getJSONArray("surahIds").ints())
      },
      if (o.isNull("sleepTimerEndsAt")) null else o.getLong("sleepTimerEndsAt"),
    )
  } catch (e: Exception) { null }

  private fun period(o: JSONObject) = AdhkarPeriodData(
    o.getString("period"), o.getString("superId"), o.getString("title"), o.getString("arabicTitle"), o.getInt("count"),
    o.getJSONArray("featured").objects().map {
      FeaturedDhikr(it.getString("id"), it.getString("arabic"), it.stringOrNull("translation"), it.getInt("repeatCount"))
    },
    o.getJSONArray("items").objects().map {
      SessionDhikr(
        it.getString("id"), it.stringOrNull("translation"), it.getInt("repeatCount"), it.stringOrNull("audioFile"),
        it.getString("mediumText"), it.getBoolean("mediumCut"), it.getString("largeText"), it.getBoolean("largeCut"),
      )
    },
  )

  fun decodeAdhkarPeriods(json: String): AdhkarPeriods? = try {
    val o = JSONObject(json)
    AdhkarPeriods(period(o.getJSONObject("morning")), period(o.getJSONObject("evening")))
  } catch (e: Exception) { null }
}

/** adhkar-periods.json from assets/widgets (scripts/generate-widget-data.ts). */
object ContentStaticData {
  @Volatile private var adhkar: AdhkarPeriods? = null

  fun adhkar(context: Context): AdhkarPeriods? =
    adhkar ?: readAsset(context, "widgets/adhkar-periods.json")?.let { ContentModels.decodeAdhkarPeriods(it) }?.also { adhkar = it }

  private fun readAsset(context: Context, path: String): String? = try {
    context.assets.open(path).bufferedReader().use { it.readText() }
  } catch (e: Exception) { null }
}
