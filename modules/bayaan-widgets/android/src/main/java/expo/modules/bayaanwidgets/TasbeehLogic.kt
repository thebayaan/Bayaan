package expo.modules.bayaanwidgets

import org.json.JSONArray
import org.json.JSONObject

/** One widget tap waiting for the app (PendingTasbeeh in tasbeeh.ts). */
data class PendingTasbeehEntry(val dhikrId: String, val count: Int, val day: String, val reset: Boolean)

/** Mirrors WidgetLogic.swift's tasbeeh helpers. */
object TasbeehLogic {
  fun parse(json: String?): List<PendingTasbeehEntry> = try {
    if (json == null) emptyList() else {
      val arr = JSONArray(json)
      (0 until arr.length()).mapNotNull { i ->
        val o = arr.optJSONObject(i) ?: return@mapNotNull null
        if (!o.has("dhikrId") || !o.has("count") || !o.has("day")) null
        else PendingTasbeehEntry(o.getString("dhikrId"), o.getInt("count"), o.getString("day"), o.optBoolean("reset", false))
      }
    }
  } catch (e: Exception) { emptyList() }

  fun encode(list: List<PendingTasbeehEntry>): String {
    val arr = JSONArray()
    for (p in list) {
      val o = JSONObject().put("dhikrId", p.dhikrId).put("count", p.count).put("day", p.day)
      if (p.reset) o.put("reset", true)
      arr.put(o)
    }
    return arr.toString()
  }

  /** Adds a tap (or reset), merging into the last entry for the same dhikr and day; drops older days. */
  fun append(list: List<PendingTasbeehEntry>, dhikrId: String, day: String, reset: Boolean): List<PendingTasbeehEntry> {
    val out = list.filter { it.day == day }.toMutableList()
    val last = out.lastOrNull()
    if (!reset && last != null && last.dhikrId == dhikrId && !last.reset) {
      out[out.size - 1] = last.copy(count = last.count + 1)
    } else {
      out.add(PendingTasbeehEntry(dhikrId, if (reset) 0 else 1, day, reset))
    }
    return out
  }

  /** The snapshot's count for today, then pending taps in order. */
  fun displayCount(entry: WidgetTasbeehEntry?, pending: List<PendingTasbeehEntry>, dhikrId: String, today: String): Int {
    var count = if (entry != null && entry.day == today) entry.count else 0
    for (p in pending) {
      if (p.dhikrId != dhikrId || p.day != today) continue
      count = if (p.reset) 0 else count + maxOf(0, p.count)
    }
    return count
  }

  fun progress(count: Int, target: Int): Float =
    if (target <= 0) 0f else minOf(1f, maxOf(0, count).toFloat() / target)
}
