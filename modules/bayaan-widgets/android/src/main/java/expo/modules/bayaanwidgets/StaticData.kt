package expo.modules.bayaanwidgets

import android.content.Context
import org.json.JSONArray
import java.util.TimeZone

data class StaticSurah(val id: Int, val name: String, val translatedName: String, val glyph: String, val artworkFile: String)
data class StaticAyah(val key: String, val surahId: Int, val ayah: Int, val surahName: String, val arabic: String, val translation: String)

/** surahs.json and ayat.json from assets/widgets (scripts/generate-widget-data.ts). */
object StaticData {
  @Volatile private var surahs: List<StaticSurah>? = null
  @Volatile private var ayat: List<StaticAyah>? = null

  fun parseSurahs(json: String): List<StaticSurah> = try {
    val arr = JSONArray(json)
    (0 until arr.length()).map { i ->
      arr.getJSONObject(i).let {
        StaticSurah(it.getInt("id"), it.getString("name"), it.getString("translatedName"), it.getString("glyph"), it.getString("artworkFile"))
      }
    }
  } catch (e: Exception) { emptyList() }

  fun parseAyat(json: String): List<StaticAyah> = try {
    val arr = JSONArray(json)
    (0 until arr.length()).map { i ->
      arr.getJSONObject(i).let {
        StaticAyah(it.getString("key"), it.getInt("surahId"), it.getInt("ayah"), it.getString("surahName"), it.getString("arabic"), it.getString("translation"))
      }
    }
  } catch (e: Exception) { emptyList() }

  fun surahs(context: Context): List<StaticSurah> =
    surahs ?: parseSurahs(readAsset(context, "widgets/surahs.json") ?: "[]").also { if (it.isNotEmpty()) surahs = it }

  fun surah(context: Context, id: Int): StaticSurah? {
    val list = surahs(context)
    return list.getOrNull(id - 1)?.takeIf { it.id == id } ?: list.firstOrNull { it.id == id }
  }

  fun ayat(context: Context): List<StaticAyah> =
    ayat ?: parseAyat(readAsset(context, "widgets/ayat.json") ?: "[]").also { if (it.isNotEmpty()) ayat = it }

  fun ayahOfTheDay(context: Context, nowMs: Long, tz: TimeZone): StaticAyah? {
    val list = ayat(context)
    return list.getOrNull(DayMath.ayahIndex(nowMs, tz, list.size))
  }

  private fun readAsset(context: Context, path: String): String? = try {
    context.assets.open(path).bufferedReader().use { it.readText() }
  } catch (e: Exception) { null }
}
