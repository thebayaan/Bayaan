// hijri/OccasionReceiver.kt
package expo.modules.bayaanwidgets.hijri

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.ContextClockReceiver

class OccasionReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = OccasionWidget()

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    ContextClockReceiver.schedule(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    ContextClockReceiver.cancelIfUnused(context)
  }
}
