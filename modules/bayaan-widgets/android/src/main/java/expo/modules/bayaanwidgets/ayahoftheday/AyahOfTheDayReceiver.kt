// ayahoftheday/AyahOfTheDayReceiver.kt
package expo.modules.bayaanwidgets.ayahoftheday

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class AyahOfTheDayReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = AyahOfTheDayWidget()

  // Also runs after a reboot, which clears alarms.
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    MidnightReceiver.schedule(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    MidnightReceiver.cancelIfUnused(context)
  }
}
