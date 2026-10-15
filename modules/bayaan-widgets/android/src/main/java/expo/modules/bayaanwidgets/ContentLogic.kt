// main/java/expo/modules/bayaanwidgets/ContentLogic.kt
package expo.modules.bayaanwidgets

import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone

enum class AdhkarPeriod { MORNING, EVENING }

enum class BayaanNowMode(val wire: String) {
  LISTENING("listening"), OCCASION("occasion"), MORNING_ADHKAR("morningAdhkar"),
  EVENING_ADHKAR("eveningAdhkar"), BEDTIME("bedtime"),
}

data class UpcomingOccasion(val id: String, val days: Int)

/** Converts a local Gregorian day number (DayMath.dayNumber) to an Umm al-Qura date. */
fun interface HijriOf {
  fun at(dayNumber: Long): HijriDate?
}

data class RecentShelf(val tracks: List<WidgetTrack>, val isSuggestion: Boolean)

sealed class LibraryShelfState {
  data class Downloads(val items: List<WidgetShelfItem>, val count: Int) : LibraryShelfState()
  data class Playlist(val playlist: WidgetPlaylist) : LibraryShelfState()
  object PlaylistUnavailable : LibraryShelfState()
  object NoContent : LibraryShelfState()
}

/**
 * Phase 3 rules. Mirrors contextRules.ts and ContentLogic.swift. Hours and
 * weekdays are Gregorian whatever calendar the device uses. Relevance scores
 * are iOS only: Android has no Smart Stack.
 */
object ContentLogic {
  const val FRIDAY = 6
  const val JUMUAH_END_HOUR = 18
  const val NEXT_OCCASION_HORIZON = 400
  val BOUNDARY_HOURS = listOf(0, 4, 11, 12, 15, 18, 20, 21)
  /** Al-Fatihah, Al-Kahf, Ya-Sin, Al-Mulk. */
  val POPULAR_SURAH_IDS = listOf(1, 18, 36, 67)
  const val DOWNLOADS = "downloads"
  const val PLAYLIST_PREFIX = "playlist:"

  private data class Window(val id: String, val month: Int, val from: Int, val to: Int)
  // Priority order; the Hijri windows do not overlap.
  private val WINDOWS = listOf(
    Window("eidFitr", 10, 1, 3), Window("arafah", 12, 9, 9), Window("eidAdha", 12, 10, 13),
    Window("lastTen", 9, 21, 30), Window("ramadan", 9, 1, 20), Window("dhulHijjah", 12, 1, 8),
    Window("ashura", 1, 9, 10),
  )

  private data class Anchor(val id: String, val month: Int, val day: Int)
  private val ANCHORS = listOf(
    Anchor("ramadan", 9, 1), Anchor("eidFitr", 10, 1), Anchor("dhulHijjah", 12, 1),
    Anchor("arafah", 12, 9), Anchor("eidAdha", 12, 10), Anchor("ashura", 1, 10),
  )

  private fun calendar(nowMs: Long, tz: TimeZone): Calendar =
    GregorianCalendar(tz, Locale.US).apply { timeInMillis = nowMs }

  fun hour(nowMs: Long, tz: TimeZone): Int = calendar(nowMs, tz).get(Calendar.HOUR_OF_DAY)

  /** Sunday = 1, Friday = 6. */
  fun weekday(nowMs: Long, tz: TimeZone): Int = calendar(nowMs, tz).get(Calendar.DAY_OF_WEEK)

  fun hijri(nowMs: Long, tz: TimeZone, hijriOf: HijriOf): HijriDate? = hijriOf.at(DayMath.dayNumber(nowMs, tz))

  fun adhkarPeriod(hour: Int): AdhkarPeriod = if (hour in 4..11) AdhkarPeriod.MORNING else AdhkarPeriod.EVENING

  fun occasion(hijri: HijriDate?, weekday: Int, hour: Int): String? {
    val hit = hijri?.let { h -> WINDOWS.firstOrNull { it.month == h.month && h.day in it.from..it.to } }
    if (hit != null) return hit.id
    return if (weekday == FRIDAY && hour < JUMUAH_END_HOUR) "jumuah" else null
  }

  fun occasionAt(nowMs: Long, tz: TimeZone, hijriOf: HijriOf): String? =
    occasion(hijri(nowMs, tz, hijriOf), weekday(nowMs, tz), hour(nowMs, tz))

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
  fun mode(hour: Int, isPlaying: Boolean, occasion: String?, adhkar: Boolean = true, bedtime: Boolean = true): BayaanNowMode = when {
    isPlaying -> BayaanNowMode.LISTENING
    occasion != null -> BayaanNowMode.OCCASION
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

  /** Scans forward day by day; stops early when the converter returns null. */
  fun nextOccasions(today: Long, count: Int, hijriOf: HijriOf, horizon: Int = NEXT_OCCASION_HORIZON): List<UpcomingOccasion> {
    val found = mutableListOf<UpcomingOccasion>()
    var d = 1
    while (d <= horizon && found.size < count) {
      val h = hijriOf.at(today + d) ?: break
      for (a in ANCHORS) {
        if (a.month == h.month && a.day == h.day && found.none { it.id == a.id }) found.add(UpcomingOccasion(a.id, d))
      }
      d++
    }
    return found.take(count)
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

  fun hijriLine(h: HijriDate, months: List<HijriMonthName>): String =
    "${h.day} ${months.firstOrNull { it.number == h.month }?.name ?: h.month.toString()} ${h.year}"

  fun daysLabel(days: Int): String = if (days == 1) "Tomorrow" else "in $days days"

  fun surahCount(n: Int): String = if (n == 1) "1 surah" else "$n surahs"

  fun repeatLabel(n: Int): String? = if (n > 1) "×$n" else null
}
