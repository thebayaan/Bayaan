// main/java/expo/modules/bayaanwidgets/ContentLogic.kt
package expo.modules.bayaanwidgets

import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone

enum class AdhkarPeriod { MORNING, EVENING }

enum class BayaanNowMode(val wire: String) {
  LISTENING("listening"), MORNING_ADHKAR("morningAdhkar"),
  EVENING_ADHKAR("eveningAdhkar"), BEDTIME("bedtime"),
}

data class RecentShelf(val tracks: List<WidgetTrack>, val isSuggestion: Boolean)

sealed class LibraryShelfState {
  data class Downloads(val items: List<WidgetShelfItem>, val count: Int) : LibraryShelfState()
  data class Playlist(val playlist: WidgetPlaylist) : LibraryShelfState()
  object PlaylistUnavailable : LibraryShelfState()
  object NoContent : LibraryShelfState()
}

/**
 * Phase 3 rules. Mirrors contextRules.ts and ContentLogic.swift. Hours are
 * Gregorian whatever calendar the device uses. Relevance scores are iOS only:
 * Android has no Smart Stack.
 */
object ContentLogic {
  val BOUNDARY_HOURS = listOf(0, 4, 11, 12, 15, 18, 20, 21)
  /** Al-Fatihah, Al-Kahf, Ya-Sin, Al-Mulk. */
  val POPULAR_SURAH_IDS = listOf(1, 18, 36, 67)
  const val DOWNLOADS = "downloads"
  const val PLAYLIST_PREFIX = "playlist:"

  private fun calendar(nowMs: Long, tz: TimeZone): Calendar =
    GregorianCalendar(tz, Locale.US).apply { timeInMillis = nowMs }

  fun hour(nowMs: Long, tz: TimeZone): Int = calendar(nowMs, tz).get(Calendar.HOUR_OF_DAY)

  fun adhkarPeriod(hour: Int): AdhkarPeriod = if (hour in 4..11) AdhkarPeriod.MORNING else AdhkarPeriod.EVENING

  /**
   * Whether the snapshot's track is still playing at nowMs (playing, and not past
   * generatedAt + remaining / rate). Bayaan Now only; it ignores the tap override.
   */
  fun playingAt(snapshot: WidgetSnapshot?, nowMs: Long): Boolean {
    val endMs = trackEndMs(snapshot) ?: return false
    return nowMs < endMs
  }

  /** When the snapshot's playing track ends (generatedAt + remaining / rate), or null when nothing is playing. */
  fun trackEndMs(snapshot: WidgetSnapshot?): Long? {
    val np = snapshot?.nowPlaying ?: return null
    if (!np.isPlaying) return null
    val rate = if (np.rate > 0 && np.rate.isFinite()) np.rate else 1.0
    val remainingMs = ((np.durationSec - np.positionSec).coerceAtLeast(0.0) / rate * 1000).toLong()
    return snapshot.generatedAt + remainingMs
  }

  /** adhkar and bedtime turn those cards off (RFC-021); their hours fall back to listening. */
  fun mode(hour: Int, isPlaying: Boolean, adhkar: Boolean = true, bedtime: Boolean = true): BayaanNowMode = when {
    isPlaying -> BayaanNowMode.LISTENING
    adhkar && hour in 4..10 -> BayaanNowMode.MORNING_ADHKAR
    adhkar && hour in 15..19 -> BayaanNowMode.EVENING_ADHKAR
    bedtime && (hour >= 21 || hour < 4) -> BayaanNowMode.BEDTIME
    else -> BayaanNowMode.LISTENING
  }

  /** Minutes since local midnight of the next boundary; 1440 is the next midnight. */
  fun nextBoundaryMinutes(minutes: Double): Int = BOUNDARY_HOURS.firstOrNull { it * 60 > minutes }?.let { it * 60 } ?: 1440

  fun nextBoundaryMs(nowMs: Long, tz: TimeZone): Long {
    val c = calendar(nowMs, tz)
    val minutes = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE) + c.get(Calendar.SECOND) / 60.0
    val next = nextBoundaryMinutes(minutes)
    c.set(Calendar.HOUR_OF_DAY, 0)
    c.set(Calendar.MINUTE, 0)
    c.set(Calendar.SECOND, 0)
    c.set(Calendar.MILLISECOND, 0)
    if (next >= 1440) c.add(Calendar.DAY_OF_MONTH, 1) else c.set(Calendar.HOUR_OF_DAY, next / 60)
    return c.timeInMillis
  }

  fun sleepActive(endsAt: Long?, nowMs: Long): Boolean = endsAt != null && endsAt > nowMs

  fun recentShelf(snapshot: WidgetSnapshot?, limit: Int = 6): RecentShelf {
    val s = snapshot ?: return RecentShelf(emptyList(), false)
    val real = s.recent.filter { !it.isUserUpload && it.surahId in 1..114 }
    if (real.isNotEmpty()) return RecentShelf(real.take(limit), false)
    val d = s.defaultReciter ?: return RecentShelf(emptyList(), false)
    return RecentShelf(POPULAR_SURAH_IDS.take(limit).map { WidgetTrack(it, "", d.id, d.name, null, null, false) }, true)
  }

  fun library(sourceId: String?, content: WidgetContent?): LibraryShelfState {
    val c = content ?: return LibraryShelfState.NoContent
    if (sourceId == null || !sourceId.startsWith(PLAYLIST_PREFIX)) return LibraryShelfState.Downloads(c.downloads, c.downloadCount)
    return c.playlist(sourceId.removePrefix(PLAYLIST_PREFIX))?.let { LibraryShelfState.Playlist(it) } ?: LibraryShelfState.PlaylistUnavailable
  }

  fun spotlight(content: WidgetContent?, nowMs: Long, tz: TimeZone): WidgetSpotlightReciter? {
    val list = content?.spotlight?.takeIf { it.isNotEmpty() } ?: return null
    return list.getOrNull(DayMath.ayahIndex(nowMs, tz, list.size))
  }

  fun surahCount(n: Int): String = if (n == 1) "1 surah" else "$n surahs"

  fun repeatLabel(n: Int): String? = if (n > 1) "×$n" else null
}
