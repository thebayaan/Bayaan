package expo.modules.bayaanwidgets

import java.util.TimeZone
import org.json.JSONObject

/** Where the Adhkar widget is in this period's session (spec 2026-10-12). Mirrors AdhkarSessionLogic.swift. */
data class AdhkarSession(
  val period: String, val day: String, val index: Int, val remaining: Int,
  val completed: Boolean, val startedAtMs: Long?,
)

enum class AdhkarSessionAction { NEXT, PREV, COUNT, RESTART }

/** The adhkar_session_completed event an action raised; the app sends it later. */
data class AdhkarSessionCompletion(val category: String, val durationMs: Long, val dhikrCount: Int, val completedAtMs: Long)

object AdhkarSessionLogic {
  private const val SHIFT_MS = 4L * 3600 * 1000

  /** Shifted 4 hours so the evening period (12:00 to 03:59) stays one session across midnight. */
  fun sessionDay(nowMs: Long, tz: TimeZone): String = DayMath.localDayKey(nowMs - SHIFT_MS, tz)

  fun fresh(period: String, day: String, repeatCounts: List<Int>) =
    AdhkarSession(period, day, 0, count(repeatCounts, 0), false, null)

  fun resolve(stored: AdhkarSession?, period: String, day: String, repeatCounts: List<Int>): AdhkarSession =
    if (stored == null || stored.period != period || stored.day != day || stored.index !in repeatCounts.indices) {
      fresh(period, day, repeatCounts)
    } else stored

  fun apply(action: AdhkarSessionAction, s: AdhkarSession, repeatCounts: List<Int>, nowMs: Long): AdhkarSession {
    if (action == AdhkarSessionAction.RESTART) return fresh(s.period, s.day, repeatCounts)
    if (s.completed) return s
    val started = s.copy(startedAtMs = s.startedAtMs ?: nowMs)
    return when (action) {
      AdhkarSessionAction.NEXT -> advance(started, repeatCounts)
      AdhkarSessionAction.COUNT -> if (s.remaining > 1) started.copy(remaining = s.remaining - 1) else advance(started, repeatCounts)
      AdhkarSessionAction.PREV -> if (s.index > 0) started.copy(index = s.index - 1, remaining = count(repeatCounts, s.index - 1)) else started
      AdhkarSessionAction.RESTART -> started
    }
  }

  /** The completion event when this action finished the session, else null (once per session). */
  fun completionEvent(
    before: AdhkarSession, after: AdhkarSession, repeatCounts: List<Int>, superId: String, nowMs: Long,
  ): AdhkarSessionCompletion? =
    if (before.completed || !after.completed) null
    else AdhkarSessionCompletion(superId, nowMs - (after.startedAtMs ?: nowMs), repeatCounts.size, nowMs)

  /** Body-tap path: the top of the list on the first card or when done, else the current dhikr. */
  fun link(superId: String, s: AdhkarSession, ids: List<String>): String =
    if (s.completed || s.index == 0 || s.index !in ids.indices) "adhkar/$superId"
    else "adhkar/$superId?dhikr=${ids[s.index]}"

  fun encode(s: AdhkarSession): String = JSONObject()
    .put("period", s.period).put("day", s.day).put("index", s.index).put("remaining", s.remaining)
    .put("completed", s.completed).put("startedAtMs", s.startedAtMs ?: JSONObject.NULL).toString()

  fun decode(json: String?): AdhkarSession? = try {
    json?.let { JSONObject(it) }?.let {
      AdhkarSession(it.getString("period"), it.getString("day"), it.getInt("index"), it.getInt("remaining"),
        it.getBoolean("completed"), if (it.isNull("startedAtMs")) null else it.getLong("startedAtMs"))
    }
  } catch (e: Exception) { null }

  private fun advance(s: AdhkarSession, repeatCounts: List<Int>): AdhkarSession =
    if (s.index + 1 >= repeatCounts.size) s.copy(completed = true, remaining = 0)
    else s.copy(index = s.index + 1, remaining = count(repeatCounts, s.index + 1))

  private fun count(repeatCounts: List<Int>, i: Int): Int = repeatCounts.getOrNull(i)?.coerceAtLeast(1) ?: 1
}
