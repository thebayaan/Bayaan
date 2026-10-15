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
data class AdhkarPeriodData(
  val period: String, val superId: String, val title: String, val arabicTitle: String, val count: Int,
  val featured: List<FeaturedDhikr>,
)
data class AdhkarPeriods(val morning: AdhkarPeriodData, val evening: AdhkarPeriodData) {
  fun of(period: AdhkarPeriod): AdhkarPeriodData = if (period == AdhkarPeriod.MORNING) morning else evening
}
data class HijriMonthName(val number: Int, val name: String, val arabic: String)
data class OccasionInfo(val id: String, val name: String, val arabicName: String, val listenSurahId: Int?, val ayat: List<StaticAyah>)
data class OccasionData(val months: List<HijriMonthName>, val occasions: List<OccasionInfo>) {
  fun occasion(id: String?): OccasionInfo? = id?.let { wanted -> occasions.firstOrNull { it.id == wanted } }
  fun month(number: Int): HijriMonthName? = months.firstOrNull { it.number == number }
}
data class HijriDate(val year: Int, val month: Int, val day: Int)

/** Decoders for content.json (content.ts) and the generated adhkar and occasion data. */
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
  )

  fun decodeAdhkarPeriods(json: String): AdhkarPeriods? = try {
    val o = JSONObject(json)
    AdhkarPeriods(period(o.getJSONObject("morning")), period(o.getJSONObject("evening")))
  } catch (e: Exception) { null }

  fun decodeOccasions(json: String): OccasionData? = try {
    val o = JSONObject(json)
    OccasionData(
      o.getJSONArray("months").objects().map { HijriMonthName(it.getInt("number"), it.getString("name"), it.getString("arabic")) },
      o.getJSONArray("occasions").objects().map { x ->
        OccasionInfo(
          x.getString("id"), x.getString("name"), x.getString("arabicName"),
          if (x.isNull("listenSurahId")) null else x.getInt("listenSurahId"),
          StaticData.parseAyat(x.getJSONArray("ayat").toString()),
        )
      },
    )
  } catch (e: Exception) { null }
}

/** adhkar-periods.json and occasions.json from assets/widgets (scripts/generate-widget-data.ts). */
object ContentStaticData {
  @Volatile private var adhkar: AdhkarPeriods? = null
  @Volatile private var occasions: OccasionData? = null

  fun adhkar(context: Context): AdhkarPeriods? =
    adhkar ?: readAsset(context, "widgets/adhkar-periods.json")?.let { ContentModels.decodeAdhkarPeriods(it) }?.also { adhkar = it }

  fun occasions(context: Context): OccasionData? =
    occasions ?: readAsset(context, "widgets/occasions.json")?.let { ContentModels.decodeOccasions(it) }?.also { occasions = it }

  private fun readAsset(context: Context, path: String): String? = try {
    context.assets.open(path).bufferedReader().use { it.readText() }
  } catch (e: Exception) { null }
}
