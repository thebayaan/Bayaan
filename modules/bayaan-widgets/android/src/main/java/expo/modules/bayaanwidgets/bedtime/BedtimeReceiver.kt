// bedtime/BedtimeReceiver.kt
package expo.modules.bayaanwidgets.bedtime

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage

class BedtimeReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = BedtimeWidget()

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    WidgetStorage.deleteConfigs(context, appWidgetIds)
  }
}
