package expo.modules.bayaanwidgets.continuelistening

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage

class ContinueListeningReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = ContinueListeningWidget()

  // Also runs after a reboot, when a stale "playing" snapshot would otherwise
  // count down past the track end.
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    runCatching {
      ContinueListeningWidget.syncTrackEndRefresh(
        context, WidgetStorage.readSnapshotJson(context), WidgetStorage.readPlaybackOverrideJson(context),
      )
    }
  }
}
