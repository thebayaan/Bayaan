package expo.modules.bayaanwidgets

import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone

/**
 * Day arithmetic for the widgets. Always Gregorian, whatever calendar the
 * device uses. Mirrors dayMath.ts and WidgetLogic.swift.
 */
object DayMath {
  private const val DAY_MS = 86_400_000L

  private fun calendar(nowMs: Long, tz: TimeZone): Calendar =
    GregorianCalendar(tz, Locale.US).apply { timeInMillis = nowMs }

  /** Days from 1970-01-01 to the local calendar date of nowMs in tz. */
  fun dayNumber(nowMs: Long, tz: TimeZone): Long {
    val local = calendar(nowMs, tz)
    val utc = GregorianCalendar(TimeZone.getTimeZone("UTC"), Locale.US).apply {
      clear()
      set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH))
    }
    return Math.floorDiv(utc.timeInMillis, DAY_MS)
  }

  fun ayahIndex(nowMs: Long, tz: TimeZone, count: Int): Int =
    if (count <= 0) -1 else Math.floorMod(dayNumber(nowMs, tz), count.toLong()).toInt()

  fun localDayKey(nowMs: Long, tz: TimeZone): String {
    val c = calendar(nowMs, tz)
    return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
  }

  fun nextLocalMidnightMs(nowMs: Long, tz: TimeZone): Long =
    calendar(nowMs, tz).apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      add(Calendar.DAY_OF_MONTH, 1)
    }.timeInMillis
}
