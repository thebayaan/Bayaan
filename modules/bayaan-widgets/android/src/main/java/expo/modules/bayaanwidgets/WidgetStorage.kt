package expo.modules.bayaanwidgets

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object WidgetStorage {
  private const val PREFS = "bayaan_widgets"
  private const val KEY_SNAPSHOT = "snapshot"
  private const val KEY_QUEUE = "commandQueue"
  private const val KEY_TASBEEH = "pendingTasbeeh"
  private const val KEY_PLAYBACK_OVERRIDE = "widgets.playbackOverride"
  private const val KEY_CATALOG = "catalog"
  private const val KEY_CONTENT = "content"
  private const val KEY_ARTWORK_REQUESTS = "artworkRequests"
  private const val KEY_ADHKAR_SESSION = "adhkarSession"
  private const val KEY_PENDING_EVENTS = "pendingEvents"
  private fun configKey(appWidgetId: Int) = "config.$appWidgetId"

  @Volatile var onCommandQueued: (() -> Unit)? = null

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun writeSnapshot(context: Context, json: String) =
    prefs(context).edit().putString(KEY_SNAPSHOT, json).apply()

  fun readSnapshotJson(context: Context): String? = prefs(context).getString(KEY_SNAPSHOT, null)

  fun readSnapshot(context: Context): WidgetSnapshot? =
    readSnapshotJson(context)?.let { SnapshotModels.decode(it) }

  fun writePlaybackOverride(context: Context, override: PlaybackOverride) {
    prefs(context).edit().putString(KEY_PLAYBACK_OVERRIDE, PlaybackState.encodeOverride(override)).commit()
  }

  fun readPlaybackOverrideJson(context: Context): String? =
    prefs(context).getString(KEY_PLAYBACK_OVERRIDE, null)

  @Synchronized
  fun enqueueCommand(context: Context, command: JSONObject) {
    val queue = JSONArray(prefs(context).getString(KEY_QUEUE, "[]"))
    queue.put(JSONObject().put("command", command).put("enqueuedAt", System.currentTimeMillis()))
    prefs(context).edit().putString(KEY_QUEUE, queue.toString()).commit()
    onCommandQueued?.invoke()
  }

  @Synchronized
  fun take(context: Context, key: String): String {
    val value = prefs(context).getString(key, "[]") ?: "[]"
    prefs(context).edit().remove(key).commit()
    return value
  }

  fun takeQueue(context: Context) = take(context, KEY_QUEUE)
  fun takeTasbeeh(context: Context) = take(context, KEY_TASBEEH)

  fun writeCatalog(context: Context, json: String) = prefs(context).edit().putString(KEY_CATALOG, json).apply()

  fun writeContent(context: Context, json: String) = prefs(context).edit().putString(KEY_CONTENT, json).apply()

  fun readContentJson(context: Context): String? = prefs(context).getString(KEY_CONTENT, null)

  fun readCatalogJson(context: Context): String? = prefs(context).getString(KEY_CATALOG, null)

  fun readPendingTasbeehJson(context: Context): String? = prefs(context).getString(KEY_TASBEEH, null)

  /** Same lock as take(), so a tap cannot interleave with the app's read-and-clear. */
  @Synchronized
  fun addPendingTasbeeh(context: Context, dhikrId: String, day: String, reset: Boolean) {
    val next = TasbeehLogic.append(TasbeehLogic.parse(readPendingTasbeehJson(context)), dhikrId, day, reset)
    prefs(context).edit().putString(KEY_TASBEEH, TasbeehLogic.encode(next)).commit()
  }

  fun readAdhkarSessionJson(context: Context): String? = prefs(context).getString(KEY_ADHKAR_SESSION, null)

  fun writeAdhkarSession(context: Context, json: String) {
    prefs(context).edit().putString(KEY_ADHKAR_SESSION, json).commit()
  }

  /** Analytics events from widget taps, sent by the app; same lock as takePendingEvents. */
  @Synchronized
  fun addPendingEvent(context: Context, event: JSONObject) {
    val list = try { JSONArray(prefs(context).getString(KEY_PENDING_EVENTS, null) ?: "[]") } catch (e: Exception) { JSONArray() }
    list.put(event)
    prefs(context).edit().putString(KEY_PENDING_EVENTS, list.toString()).commit()
  }

  @Synchronized
  fun takePendingEvents(context: Context): String {
    val value = prefs(context).getString(KEY_PENDING_EVENTS, "[]") ?: "[]"
    prefs(context).edit().remove(KEY_PENDING_EVENTS).commit()
    return value
  }

  fun writeConfig(context: Context, appWidgetId: Int, json: String) =
    prefs(context).edit().putString(configKey(appWidgetId), json).apply()

  fun readConfigJson(context: Context, appWidgetId: Int): String? = prefs(context).getString(configKey(appWidgetId), null)

  fun deleteConfigs(context: Context, appWidgetIds: IntArray) {
    val edit = prefs(context).edit()
    for (id in appWidgetIds) edit.remove(configKey(id))
    edit.apply()
  }

  /** Records artwork a widget wanted but did not find; writes only when the list changes. */
  @Synchronized
  fun recordArtworkRequests(context: Context, surahIds: List<Int>, reciterIds: List<String>) {
    if (surahIds.isEmpty() && reciterIds.isEmpty()) return
    val existing = ArtworkRequestsJson.decode(prefs(context).getString(KEY_ARTWORK_REQUESTS, null))
    val merged = ArtworkRequestsJson.merge(existing, surahIds, reciterIds)
    if (merged != existing) prefs(context).edit().putString(KEY_ARTWORK_REQUESTS, ArtworkRequestsJson.encode(merged)).apply()
  }

  fun readArtworkRequestsJson(context: Context): String = prefs(context).getString(KEY_ARTWORK_REQUESTS, null) ?: "{}"

  fun artworkDir(context: Context): File =
    File(context.filesDir, "widgets/artwork").apply { mkdirs() }
}
