// continuereading/ContinueReadingReceiver.kt
package expo.modules.bayaanwidgets.continuereading

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class ContinueReadingReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = ContinueReadingWidget()
}
