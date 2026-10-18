// recentlyplayed/RecentlyPlayedReceiver.kt
package expo.modules.bayaanwidgets.recentlyplayed

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class RecentlyPlayedReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = RecentlyPlayedWidget()
}
