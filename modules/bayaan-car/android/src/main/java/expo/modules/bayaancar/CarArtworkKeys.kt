package expo.modules.bayaancar

import java.security.MessageDigest

/** A validated artwork key. Pure data so it can be unit tested on the JVM. */
sealed class ArtworkKey {
  data class Surah(val surahId: Int) : ArtworkKey()
  data class Url(val encoded: String) : ArtworkKey()
  data class Asset(val encoded: String) : ArtworkKey()
  data class Tile(val encoded: String) : ArtworkKey()
  /** [name] is one of [CarArtworkKeys.ICON_NAMES]; [hex] (RRGGBB) only for "playlist". */
  data class Icon(val name: String, val hex: String?) : ArtworkKey()
}

object CarArtworkKeys {
  const val SIZE = 256
  const val MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024
  const val MAX_CACHE_FILES = 1000
  const val MAX_CACHE_BYTES = 50L * 1024 * 1024

  private val payload = Regex("[A-Za-z0-9_-]{1,2048}")
  private val surahKey = Regex("surah-([0-9]{1,3})")
  private val drawableName = Regex("[A-Za-z0-9_]{1,128}")
  private val iconKeyPattern = Regex("icon-(loved|playlists|downloads|uploads|reciters|random|playlist)(?:-([0-9A-Fa-f]{6}))?")
  private val hex6 = Regex("#?([0-9A-Fa-f]{6})")

  /** The bundled icon tiles; nothing else ever reaches a resource lookup. */
  val ICON_NAMES = setOf("loved", "playlists", "downloads", "uploads", "reciters", "random", "playlist")
  const val PLAYLIST = "playlist"
  /** Used when a playlist colour is missing or malformed (the app's playlist colour). */
  const val DEFAULT_PLAYLIST_HEX = "6366F1"
  /** Collection screen tile: 12dp corners on a 46dp square. */
  const val ICON_CORNER_RATIO = 12f / 46f

  /**
   * Content key for an icon tile. Only "playlist" carries a colour (RRGGBB); a
   * malformed colour is dropped so the tile falls back to the default.
   */
  fun iconKey(name: String, hex: String?): String? {
    if (name !in ICON_NAMES) return null
    if (name != PLAYLIST) return "icon-$name"
    val color = hex?.let { hex6.matchEntire(it)?.groupValues?.get(1) } ?: return "icon-$name"
    return "icon-$name-${color.uppercase()}"
  }

  /** Strictly validates a URI path segment. Returns null for anything unexpected. */
  fun parseKey(key: String?): ArtworkKey? {
    if (key.isNullOrEmpty()) return null
    iconKeyPattern.matchEntire(key)?.let { m ->
      val name = m.groupValues[1]
      val hex = m.groupValues[2].ifEmpty { null }
      // Only a playlist tile takes a colour.
      if (hex != null && name != PLAYLIST) return null
      return ArtworkKey.Icon(name, hex)
    }
    surahKey.matchEntire(key)?.let { m ->
      val id = m.groupValues[1].toInt()
      return if (id in 1..114 && m.groupValues[1] == id.toString()) ArtworkKey.Surah(id) else null
    }
    val dash = key.indexOf('-')
    if (dash <= 0) return null
    val body = key.substring(dash + 1)
    if (!payload.matches(body)) return null
    return when (key.substring(0, dash)) {
      "url" -> ArtworkKey.Url(body)
      "asset" -> ArtworkKey.Asset(body)
      "tile" -> ArtworkKey.Tile(body)
      else -> null
    }
  }

  fun isValidDrawableName(name: String): Boolean = drawableName.matches(name)

  /** On-disk file name: SHA-256 hex of the key, so keys never touch the file system. */
  fun fileNameFor(key: String): String =
    MessageDigest.getInstance("SHA-256").digest(key.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) } + ".png"

  /** Every https artwork URL referenced by the snapshot and now playing. */
  fun allowedUrls(snapshot: CarSnapshot?, nowPlaying: CarNowPlaying?): Set<String> {
    val out = HashSet<String>()
    fun add(a: CarArtwork?) {
      val u = when (a) {
        is CarArtwork.Url -> a.url
        is CarArtwork.Asset -> a.uri
        else -> null
      } ?: return
      if (isHttps(u)) out.add(u)
    }
    add(nowPlaying?.artwork)
    if (snapshot == null) return out
    snapshot.reciters.forEach { add(it.artwork) }
    snapshot.library.forEach { add(it.artwork) }
    snapshot.sections.forEach { s -> s.items.forEach { add(it.artwork) } }
    snapshot.lists.values.forEach { l -> l.items.forEach { add(it.artwork) } }
    return out
  }

  fun isHttps(url: String): Boolean = url.startsWith("https://") && url.length > "https://".length

  const val DEFAULT_SURAH_BASE = "https://cdn.thebayaan.com/assets/car/surah/"
  private val surahBasePattern = Regex("https://[^\\s?#\\\\]+/")

  /** The snapshot's surah base when it is an https URL ending in '/', else the default CDN. */
  fun surahBase(fromSnapshot: String?): String =
    fromSnapshot?.takeIf { surahBasePattern.matches(it) && !it.contains("/../") } ?: DEFAULT_SURAH_BASE

  /** Surah fetches only ever go to `{base}{id}.png`. */
  fun surahUrl(fromSnapshot: String?, surahId: Int): String = "${surahBase(fromSnapshot)}$surahId.png"

  /** Largest power-of-two sample size that keeps both dimensions at or above [target]. */
  fun sampleSize(width: Int, height: Int, target: Int = SIZE): Int {
    if (width <= 0 || height <= 0) return 1
    var sample = 1
    val shortSide = minOf(width, height)
    while (shortSide / (sample * 2) >= target) sample *= 2
    return sample
  }

  /** Center square crop as (left, top, side). */
  fun centerSquare(width: Int, height: Int): Triple<Int, Int, Int> {
    val side = minOf(width, height)
    return Triple((width - side) / 2, (height - side) / 2, side)
  }

  /** First 3 grapheme clusters of the label, not case-changed (matches iOS `label.prefix(3)`). */
  fun tileText(label: String): String {
    if (label.isBlank()) return ""
    val it = java.text.BreakIterator.getCharacterInstance()
    it.setText(label)
    var end = 0
    var count = 0
    while (count < 3) {
      val next = it.next()
      if (next == java.text.BreakIterator.DONE) break
      end = next
      count++
    }
    return label.substring(0, end)
  }

  const val DEFAULT_TILE_HEX = "#333333"
  private val hexColor = Regex("#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?")

  /** Splits "label|hex" on the last '|'; an invalid or missing hex becomes the neutral default. */
  fun parseTile(decoded: String): Pair<String, String> {
    val bar = decoded.lastIndexOf('|')
    if (bar < 0) return decoded to DEFAULT_TILE_HEX
    val hex = decoded.substring(bar + 1)
    return decoded.substring(0, bar) to (if (hexColor.matches(hex)) hex else DEFAULT_TILE_HEX)
  }

  const val MAX_ASPECT = 4
  const val MAX_SIDE = 10_000

  /** Rejects absurd aspect ratios and sizes before any pixel decode. */
  fun isDecodable(width: Int, height: Int): Boolean {
    if (width <= 0 || height <= 0) return false
    val long = maxOf(width, height)
    val short = minOf(width, height)
    return long <= MAX_SIDE && long <= short.toLong() * MAX_ASPECT
  }

  /** Files to delete (oldest first) so the cache stays within both bounds. */
  fun evictionOrder(files: List<Pair<String, Pair<Long, Long>>>, maxFiles: Int = MAX_CACHE_FILES, maxBytes: Long = MAX_CACHE_BYTES): List<String> {
    // Each entry: name to (lastModified, length).
    val sorted = files.sortedBy { it.second.first }
    var count = sorted.size
    var bytes = sorted.sumOf { it.second.second }
    val out = ArrayList<String>()
    for (f in sorted) {
      if (count <= maxFiles && bytes <= maxBytes) break
      out.add(f.first)
      count--
      bytes -= f.second.second
    }
    return out
  }
}
