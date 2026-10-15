package expo.modules.bayaancar

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/** Debug-only logging; enabled by CarBridge.init for debuggable apps. */
object CarLog {
  @Volatile var enabled = false
  fun d(message: String) {
    if (enabled) Log.d("BayaanCar", message)
  }
}

sealed class CarArtwork {
  data class Surah(val surahId: Int) : CarArtwork()
  data class Url(val url: String) : CarArtwork()
  data class Asset(val uri: String) : CarArtwork()
  data class Monogram(val label: String, val hex: String) : CarArtwork()
  data class Color(val label: String, val hex: String) : CarArtwork()
  /** A bundled icon tile; [name] is always one of [CarArtworkKeys.ICON_NAMES]. */
  data class Icon(val name: String, val hex: String?) : CarArtwork()

  companion object {
    fun parse(o: JSONObject): CarArtwork = when (o.optString("kind")) {
      "surah" -> Surah(o.getInt("surahId"))
      "url" -> Url(o.getString("url"))
      "asset" -> Asset(o.getString("uri"))
      "monogram" -> Monogram(o.getString("label"), o.getString("hex"))
      "color" -> Color(o.optString("label"), o.optString("hex", "#333333"))
      "icon" -> o.optString("name").let { name ->
        if (name in CarArtworkKeys.ICON_NAMES) {
          Icon(name, if (o.has("hex") && !o.isNull("hex")) o.optString("hex") else null)
        } else {
          CarLog.d("unknown icon name, using neutral fallback")
          Color("", "#333333")
        }
      }
      else -> {
        CarLog.d("unknown artwork kind, using neutral fallback")
        Color("", "#333333")
      }
    }
  }
}

sealed class CarItemAction {
  data class Play(val requestJson: String) : CarItemAction()
  data class BrowseList(val listId: String) : CarItemAction()
  data class BrowseReciter(val reciterId: String) : CarItemAction()
  data class BrowseSurahReciters(val surahId: Int) : CarItemAction()

  companion object {
    fun parse(o: JSONObject): CarItemAction {
      val kind = o.getString("kind")
      if (kind == "play") return Play(o.getJSONObject("request").toString())
      require(kind == "browse") { "unknown action kind" }
      val t = o.getJSONObject("target")
      return when (t.optString("kind")) {
        "reciter" -> BrowseReciter(t.getString("reciterId"))
        "surahReciters" -> BrowseSurahReciters(t.getInt("surahId"))
        "list" -> BrowseList(t.getString("listId"))
        else -> throw IllegalArgumentException("unknown target kind")
      }
    }
  }
}

data class CarItem(
  val id: String,
  val title: String,
  val subtitle: String?,
  val artwork: CarArtwork,
  val progress: Double?,
  val isDownloaded: Boolean,
  val action: CarItemAction,
) {
  companion object {
    fun parse(o: JSONObject) = CarItem(
      id = o.getString("id"),
      title = o.getString("title"),
      subtitle = if (o.has("subtitle") && !o.isNull("subtitle")) o.getString("subtitle") else null,
      artwork = CarArtwork.parse(o.getJSONObject("artwork")),
      progress = if (o.has("progress") && !o.isNull("progress")) o.getDouble("progress") else null,
      isDownloaded = o.optBoolean("isDownloaded", false),
      action = CarItemAction.parse(o.getJSONObject("action")),
    )
  }
}

data class CarSection(val id: String, val title: String, val style: String, val items: List<CarItem>)
data class CarList(val id: String, val title: String, val items: List<CarItem>)
data class CarRewayah(val id: String, val name: String, val style: String, val surahIds: List<Int>)
data class CarReciter(val id: String, val name: String, val artwork: CarArtwork, val isFavorite: Boolean, val rewayat: List<CarRewayah>)
data class CarSurah(val id: Int, val name: String, val nameArabic: String, val translation: String, val versesCount: Int)
data class CarJuz(val number: Int, val surahIds: List<Int>, val title: String? = null)

data class CarSnapshot(
  val topReciterId: String?,
  val sections: List<CarSection>,
  val library: List<CarItem>,
  val lists: Map<String, CarList>,
  val reciters: List<CarReciter>,
  val surahs: List<CarSurah>,
  val juz: List<CarJuz>,
  val downloadedKeys: Set<String>,
  val surahArtworkBase: String? = null,
) {
  companion object {
    /** Parses each element on its own; malformed elements are skipped, not fatal. */
    private fun <T : Any> JSONArray.mapObjects(f: (JSONObject) -> T): List<T> {
      var skipped = 0
      val out = (0 until length()).mapNotNull { i ->
        runCatching { f(getJSONObject(i)) }.getOrNull().also { if (it == null) skipped++ }
      }
      if (skipped > 0) CarLog.d("skipped $skipped malformed element(s)")
      return out
    }
    private fun JSONArray.ints(): List<Int> = (0 until length()).map { getInt(it) }

    fun parse(json: String): CarSnapshot? = runCatching {
      val o = JSONObject(json)
      if (o.getInt("version") != 1) return null
      val home = o.getJSONObject("home")
      val listsObj = o.getJSONObject("lists")
      CarSnapshot(
        topReciterId = if (o.isNull("topReciterId")) null else o.getString("topReciterId"),
        sections = home.getJSONArray("sections").mapObjects {
          CarSection(it.getString("id"), it.getString("title"), it.getString("style"), it.getJSONArray("items").mapObjects(CarItem::parse))
        },
        library = o.getJSONArray("library").mapObjects(CarItem::parse),
        lists = listsObj.keys().asSequence().mapNotNull { key ->
          runCatching {
            val l = listsObj.getJSONObject(key)
            key to CarList(l.getString("id"), l.getString("title"), l.getJSONArray("items").mapObjects(CarItem::parse))
          }.onFailure { CarLog.d("skipped malformed list $key: $it") }.getOrNull()
        }.toMap(),
        reciters = o.getJSONArray("reciters").mapObjects { r ->
          CarReciter(
            r.getString("id"), r.getString("name"), CarArtwork.parse(r.getJSONObject("artwork")), r.getBoolean("isFavorite"),
            r.getJSONArray("rewayat").mapObjects { w -> CarRewayah(w.getString("id"), w.getString("name"), w.getString("style"), w.getJSONArray("surahIds").ints()) },
          )
        },
        surahs = o.getJSONArray("surahs").mapObjects { s ->
          CarSurah(s.getInt("id"), s.getString("name"), s.getString("nameArabic"), s.getString("translation"), s.getInt("versesCount"))
        },
        juz = o.getJSONArray("juz").mapObjects { j ->
          CarJuz(j.getInt("number"), j.getJSONArray("surahIds").ints(), j.optString("title").takeIf { it.isNotEmpty() })
        },
        downloadedKeys = o.getJSONArray("downloadedKeys").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() },
        surahArtworkBase = if (o.has("surahArtworkBase") && !o.isNull("surahArtworkBase")) o.getString("surahArtworkBase") else null,
      )
    }.onFailure { CarLog.d("snapshot parse failed: $it") }.getOrNull()
  }
}

data class CarQueueEntry(val title: String, val subtitle: String, val surahId: Int?)

data class CarNowPlaying(
  val title: String,
  val subtitle: String,
  val reciterId: String?,
  val surahId: Int?,
  val isPlaying: Boolean,
  val positionSec: Double,
  val durationSec: Double,
  val rate: Double,
  val repeatMode: String,
  val isLoved: Boolean,
  val artwork: CarArtwork?,
  val queue: List<CarQueueEntry>,
  val currentIndex: Int,
  val receivedAtMs: Long,
) {
  companion object {
    private fun JSONArray.mapQueue(): List<CarQueueEntry> {
      var skipped = 0
      val out = (0 until length()).mapNotNull { i ->
        runCatching {
          val e = getJSONObject(i)
          CarQueueEntry(e.getString("title"), e.getString("subtitle"), if (e.isNull("surahId")) null else e.getInt("surahId"))
        }.getOrNull().also { if (it == null) skipped++ }
      }
      if (skipped > 0) CarLog.d("skipped $skipped malformed queue entr(ies)")
      return out
    }

    fun parse(json: String): CarNowPlaying? = runCatching {
      val o = JSONObject(json)
      val q = o.getJSONArray("queue")
      CarNowPlaying(
        title = o.getString("title"),
        subtitle = o.getString("subtitle"),
        reciterId = if (o.isNull("reciterId")) null else o.getString("reciterId"),
        surahId = if (o.isNull("surahId")) null else o.getInt("surahId"),
        isPlaying = o.getBoolean("isPlaying"),
        positionSec = o.getDouble("position"),
        durationSec = o.getDouble("duration"),
        rate = o.getDouble("rate"),
        repeatMode = o.getString("repeatMode"),
        isLoved = o.getBoolean("isLoved"),
        artwork = if (o.has("artwork") && !o.isNull("artwork")) {
          runCatching { CarArtwork.parse(o.getJSONObject("artwork")) }
            .onFailure { CarLog.d("dropped malformed nowPlaying artwork") }
            .getOrNull()
        } else null,
        queue = q.mapQueue(),
        currentIndex = o.getInt("currentIndex"),
        receivedAtMs = android.os.SystemClock.elapsedRealtime(),
      )
    }.getOrNull()
  }
}
