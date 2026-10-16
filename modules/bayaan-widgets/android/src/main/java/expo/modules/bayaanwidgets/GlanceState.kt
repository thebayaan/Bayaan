package expo.modules.bayaanwidgets

import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState

/** The stored inputs a Phase 1b widget composes from. */
data class WidgetInputs(
  val snapshotJson: String?, val catalogJson: String?, val configJson: String?, val pendingTasbeehJson: String?,
  /** Changes on every push. Artwork is read from disk, not from these inputs, so widgets showing it key on this. */
  val pushedAt: Long? = null,
  val contentJson: String? = null,
)

/**
 * A live Glance session recomposes only from its own state, so each push copies
 * the stored inputs into every instance's state (the approach Continue
 * Listening uses, generalized).
 */
object GlanceState {
  private val SNAPSHOT = stringPreferencesKey("snapshot")
  private val CATALOG = stringPreferencesKey("catalog")
  private val CONFIG = stringPreferencesKey("config")
  private val PENDING_TASBEEH = stringPreferencesKey("pendingTasbeeh")
  private val CONTENT = stringPreferencesKey("content")
  private val PUSHED_AT = longPreferencesKey("pushedAt")

  fun appWidgetId(context: Context, id: GlanceId): Int = GlanceAppWidgetManager(context).getAppWidgetId(id)

  fun stored(context: Context, appWidgetId: Int): WidgetInputs = WidgetInputs(
    WidgetStorage.readSnapshotJson(context), WidgetStorage.readCatalogJson(context),
    WidgetStorage.readConfigJson(context, appWidgetId), WidgetStorage.readPendingTasbeehJson(context),
    contentJson = WidgetStorage.readContentJson(context),
  )

  /** State after the first push; the stored values before it. */
  fun current(prefs: Preferences, fallback: WidgetInputs): WidgetInputs =
    if (prefs[PUSHED_AT] == null) fallback
    else WidgetInputs(prefs[SNAPSHOT], prefs[CATALOG], prefs[CONFIG], prefs[PENDING_TASBEEH], prefs[PUSHED_AT], prefs[CONTENT])

  suspend fun push(context: Context, widget: GlanceAppWidget) {
    val manager = GlanceAppWidgetManager(context)
    for (id in manager.getGlanceIds(widget.javaClass)) {
      val inputs = stored(context, manager.getAppWidgetId(id))
      updateAppWidgetState(context, id) { prefs ->
        put(prefs, SNAPSHOT, inputs.snapshotJson)
        put(prefs, CATALOG, inputs.catalogJson)
        put(prefs, CONFIG, inputs.configJson)
        put(prefs, PENDING_TASBEEH, inputs.pendingTasbeehJson)
        put(prefs, CONTENT, inputs.contentJson)
        prefs[PUSHED_AT] = System.currentTimeMillis()
      }
      widget.update(context, id)
    }
  }

  private fun put(prefs: MutablePreferences, key: Preferences.Key<String>, value: String?) {
    if (value != null) prefs[key] = value else prefs.remove(key)
  }
}
