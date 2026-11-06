package expo.modules.bayaancar

import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.session.MediaConstants
import org.json.JSONObject
import java.net.URLEncoder
import java.net.URLDecoder

object CarBrowseTree {
  private const val DOWNLOAD_STATUS = "android.media.extra.DOWNLOAD_STATUS"
  private const val STATUS_DOWNLOADED = 2L

  val tabs = listOf("tab:home" to "Home", "tab:library" to "Library", "tab:reciters" to "Reciters", "tab:surahs" to "Surahs")

  private fun encode(text: String): String = URLEncoder.encode(text, "UTF-8")

  /**
   * A playable's media id: its request, plus [key] when the same request can
   * appear twice on one screen (Friday's Al-Kahf card and Al-Kahf in More
   * from). Android Auto keys items by media id, so ids must be unique.
   */
  fun playId(requestJson: String, key: String? = null): String =
    "play:" + encode(requestJson) + (key?.let { "~" + encode(it) } ?: "")

  fun requestFromPlayId(mediaId: String): String? {
    if (!mediaId.startsWith("play:")) return null
    // URLEncoder always escapes '~', so the key suffix splits off cleanly.
    val encoded = mediaId.removePrefix("play:").substringBefore('~')
    return runCatching { URLDecoder.decode(encoded, "UTF-8") }.getOrNull()
  }

  fun surahRequest(reciterId: String, rewayatId: String, surahId: Int): String =
    JSONObject().put("kind", "surah").put("reciterId", reciterId).put("rewayatId", rewayatId).put("surahId", surahId).toString()

  private const val MAX_CHILDREN = 500
  private const val MAX_RECITERS = 250

  /** One page of [items]; page and pageSize come from the controller and are clamped. */
  fun <T> slice(items: List<T>, page: Int, pageSize: Int): List<T> {
    if (page < 0 || pageSize <= 0) return emptyList()
    val from = page.toLong() * pageSize
    if (from >= items.size) return emptyList()
    val to = minOf(items.size.toLong(), from + pageSize, from + MAX_CHILDREN)
    return items.subList(from.toInt(), to.toInt())
  }

  fun root(): MediaItem = browsable("root", CarBrand.name, null, null)

  fun children(parentId: String): List<MediaItem> {
    if (parentId == "root") return tabs.map { (id, title) -> browsable(id, title, null, gridStyle(id != "tab:surahs")) }
    val s = CarBridge.snapshot ?: return listOf(message(CarBrand.unavailableMessage()))
    return when {
      parentId == "tab:home" -> home(s).orIfEmpty()
      parentId == "tab:library" -> s.library.map { item(it, null) }.orIfEmpty()
      parentId == "tab:reciters" -> s.reciters.sortedByDescending { it.isFavorite }.take(MAX_RECITERS)
        .map { reciter(it, if (it.isFavorite) "Favorite reciters" else "All reciters") }.orIfEmpty()
      parentId == "tab:surahs" -> s.juz.flatMap { juz ->
        juz.surahIds.mapNotNull { id -> s.surahs.firstOrNull { it.id == id } }.map { surahBrowse(it, juz.title ?: "Juz ${juz.number}") }
      }
      parentId.startsWith("list:") -> s.lists[parentId.removePrefix("list:")]?.items?.map { item(it, null) }.orEmpty().orIfEmpty()
      parentId.startsWith("reciter:") -> reciterChildren(s, parentId.removePrefix("reciter:"))
      parentId.startsWith("rewayah:") -> {
        val (reciterId, rewayatId) = parentId.removePrefix("rewayah:").split(":", limit = 2).let { it[0] to it.getOrElse(1) { "" } }
        rewayahSurahs(s, reciterId, rewayatId)
      }
      parentId.startsWith("surah:") -> surahReciters(s, parentId.removePrefix("surah:").toIntOrNull() ?: 0)
      else -> emptyList()
    }
  }

  private fun List<MediaItem>.orIfEmpty(): List<MediaItem> = ifEmpty { listOf(message("Nothing here yet")) }

  private fun home(s: CarSnapshot): List<MediaItem> {
    val out = mutableListOf<MediaItem>()
    s.sections.forEach { section ->
      // An untitled section (Surprise me) stands alone, outside any group.
      val group = section.title.ifEmpty { null }
      section.items.forEach { out.add(item(it, group, grid = true)) }
    }
    return out
  }

  private fun reciterChildren(s: CarSnapshot, reciterId: String): List<MediaItem> {
    val r = s.reciters.firstOrNull { it.id == reciterId } ?: return emptyList()
    if (r.rewayat.size == 1) return rewayahSurahs(s, r.id, r.rewayat[0].id)
    return r.rewayat.map { w -> browsable("rewayah:${r.id}:${w.id}", w.name, "${w.surahIds.size} surahs", null) }
  }

  private fun rewayahSurahs(s: CarSnapshot, reciterId: String, rewayatId: String): List<MediaItem> {
    val r = s.reciters.firstOrNull { it.id == reciterId } ?: return emptyList()
    val w = r.rewayat.firstOrNull { it.id == rewayatId } ?: return emptyList()
    return w.surahIds.mapNotNull { sid ->
      val surah = s.surahs.firstOrNull { it.id == sid } ?: return@mapNotNull null
      val extras = Bundle()
      if (s.downloadedKeys.contains("${r.id}:${w.id}:$sid")) extras.putLong(DOWNLOAD_STATUS, STATUS_DOWNLOADED)
      playable(playId(surahRequest(r.id, w.id, sid)), "$sid. ${surah.name}", surah.translation, CarArtwork.Surah(sid), extras)
    }
  }

  private fun surahReciters(s: CarSnapshot, surahId: Int): List<MediaItem> {
    val surah = s.surahs.firstOrNull { it.id == surahId } ?: return emptyList()
    val out = mutableListOf<MediaItem>()
    val top = s.reciters.firstOrNull { it.id == s.topReciterId }
    top?.rewayat?.firstOrNull { it.surahIds.contains(surahId) }?.let { w ->
      out.add(playable(playId(surahRequest(top.id, w.id, surahId), "top"), "Play with ${top.name}", surah.name, CarArtwork.Surah(surahId), groupTitle(surah.name)))
    }
    s.reciters.forEach { r ->
      val w = r.rewayat.firstOrNull { it.surahIds.contains(surahId) } ?: return@forEach
      out.add(playable(playId(surahRequest(r.id, w.id, surahId), r.id), r.name, if (r.rewayat.size > 1) w.name else null, r.artwork, groupTitle("Choose reciter")))
    }
    return out
  }

  private fun surahBrowse(surah: CarSurah, group: String): MediaItem =
    browsable("surah:${surah.id}", "${surah.id}. ${surah.name}", surah.translation, groupTitle(group), CarArtwork.Surah(surah.id))

  private fun reciter(r: CarReciter, group: String): MediaItem =
    browsable("reciter:${r.id}", r.name, if (r.rewayat.size > 1) "${r.rewayat.size} rewayat" else null, groupTitle(group), r.artwork)

  private fun item(i: CarItem, group: String?, grid: Boolean = false): MediaItem {
    val extras = group?.let { groupTitle(it) } ?: Bundle()
    // Per-item hint: a playable in a grid tab otherwise follows the tab's list playable style.
    if (grid && i.action is CarItemAction.Play) {
      extras.putInt(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_SINGLE_ITEM, MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_GRID_ITEM)
    }
    i.progress?.let {
      extras.putInt(MediaConstants.EXTRAS_KEY_COMPLETION_STATUS, MediaConstants.EXTRAS_VALUE_COMPLETION_STATUS_PARTIALLY_PLAYED)
      extras.putDouble(MediaConstants.EXTRAS_KEY_COMPLETION_PERCENTAGE, it)
    }
    if (i.isDownloaded) extras.putLong(DOWNLOAD_STATUS, STATUS_DOWNLOADED)
    return when (val a = i.action) {
      is CarItemAction.Play -> playable(playId(a.requestJson, i.id), i.title, i.subtitle, i.artwork, extras)
      is CarItemAction.BrowseList -> browsable("list:${a.listId}", i.title, i.subtitle, extras, i.artwork)
      is CarItemAction.BrowseReciter -> browsable("reciter:${a.reciterId}", i.title, i.subtitle, extras, i.artwork)
      is CarItemAction.BrowseSurahReciters -> browsable("surah:${a.surahId}", i.title, i.subtitle, extras, i.artwork)
    }
  }

  private fun groupTitle(title: String) = Bundle().apply { putString(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_GROUP_TITLE, title) }

  private fun gridStyle(grid: Boolean) = Bundle().apply {
    val style = if (grid) MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_GRID_ITEM else MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_LIST_ITEM
    putInt(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_BROWSABLE, style)
    putInt(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_PLAYABLE, MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_LIST_ITEM)
  }

  private fun message(text: String): MediaItem = MediaItem.Builder().setMediaId("message").setMediaMetadata(
    MediaMetadata.Builder().setTitle(text).setIsBrowsable(false).setIsPlayable(false).build(),
  ).build()

  private fun browsable(id: String, title: String, subtitle: String?, extras: Bundle?, artwork: CarArtwork? = null): MediaItem =
    MediaItem.Builder().setMediaId(id).setMediaMetadata(
      MediaMetadata.Builder()
        .setTitle(title)
        .setSubtitle(subtitle)
        .setIsBrowsable(true)
        .setIsPlayable(false)
        .setExtras(extras)
        .apply { artwork?.let { setArtworkUri(CarArtworkProvider.uriFor(it)) } }
        .build(),
    ).build()

  private fun playable(id: String, title: String, subtitle: String?, artwork: CarArtwork, extras: Bundle): MediaItem =
    MediaItem.Builder().setMediaId(id).setMediaMetadata(
      MediaMetadata.Builder()
        .setTitle(title)
        .setSubtitle(subtitle)
        .setIsBrowsable(false)
        .setIsPlayable(true)
        .setExtras(extras)
        .setArtworkUri(CarArtworkProvider.uriFor(artwork))
        .build(),
    ).build()
}
