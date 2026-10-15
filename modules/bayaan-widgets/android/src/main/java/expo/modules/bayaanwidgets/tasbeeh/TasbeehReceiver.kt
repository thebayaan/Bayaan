// tasbeeh/TasbeehReceiver.kt
package expo.modules.bayaanwidgets.tasbeeh

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ayahoftheday.MidnightReceiver

class TasbeehReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = TasbeehWidget()

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    MidnightReceiver.schedule(context)
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    WidgetStorage.deleteConfigs(context, appWidgetIds)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    MidnightReceiver.cancelIfUnused(context)
  }
}
