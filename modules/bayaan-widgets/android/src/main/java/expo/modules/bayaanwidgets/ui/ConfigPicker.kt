package expo.modules.bayaanwidgets.ui

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetManager
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidget
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.WidgetStorage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Plain dialogs for the widget configuration activities. */
object ConfigPicker {
  private const val THEME = android.R.style.Theme_DeviceDefault_Dialog_Alert

  /**
   * Call first in onCreate: reads the appWidgetId, defaults the result to
   * RESULT_CANCELED, and finishes on an invalid id. Returns the id, or null
   * when the activity finished.
   */
  fun begin(activity: Activity): Int? {
    val appWidgetId = activity.intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID
    activity.setResult(Activity.RESULT_CANCELED, resultIntent(appWidgetId))
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      activity.finish()
      return null
    }
    return appWidgetId
  }

  /** Stores the config, pushes it to the widget's instances, returns RESULT_OK and finishes. */
  fun save(activity: Activity, appWidgetId: Int, configJson: String, widget: GlanceAppWidget) {
    WidgetStorage.writeConfig(activity, appWidgetId, configJson)
    activity.setResult(Activity.RESULT_OK, resultIntent(appWidgetId))
    val ctx = activity.applicationContext
    CoroutineScope(Dispatchers.Default).launch { runCatching { GlanceState.push(ctx, widget) } }
    activity.finish()
  }

  private fun resultIntent(appWidgetId: Int): Intent = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)

  /** A list of settings rows with a Done button. */
  fun menu(activity: Activity, title: String, rows: List<String>, onPick: (Int) -> Unit, onDone: () -> Unit, onCancel: () -> Unit) {
    AlertDialog.Builder(activity, THEME)
      .setTitle(title)
      .setItems(rows.toTypedArray()) { _, which -> onPick(which) }
      .setPositiveButton("Done") { _, _ -> onDone() }
      .setOnCancelListener { onCancel() }
      .show()
  }

  fun pick(activity: Activity, title: String, items: List<String>, onPick: (Int) -> Unit, onCancel: () -> Unit) {
    AlertDialog.Builder(activity, THEME)
      .setTitle(title)
      .setItems(items.toTypedArray()) { _, which -> onPick(which) }
      .setOnCancelListener { onCancel() }
      .show()
  }
}
