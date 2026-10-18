// main/java/expo/modules/bayaanwidgets/ContextClockReceiver.kt
package expo.modules.bayaanwidgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidget
import expo.modules.bayaanwidgets.adhkar.AdhkarReceiver
import expo.modules.bayaanwidgets.adhkar.AdhkarWidget
import expo.modules.bayaanwidgets.bayaannow.BayaanNowReceiver
import expo.modules.bayaanwidgets.bayaannow.BayaanNowWidget
import expo.modules.bayaanwidgets.spotlight.ReciterSpotlightReceiver
import expo.modules.bayaanwidgets.spotlight.ReciterSpotlightWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.TimeZone

/** A Phase 3 widget whose content changes at context boundaries. */
class ClockTarget(val receiver: Class<*>, val widget: () -> GlanceAppWidget)

/**
 * Re-renders the date and time driven Phase 3 widgets at the next context
 * boundary (00:00, 04:00, 11:00, 12:00, 15:00, 18:00, 20:00, 21:00). Inexact
 * and permission free, like MidnightReceiver.
 */
class ContextClockReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    val app = context.applicationContext
    CoroutineScope(Dispatchers.Default).launch {
      try {
        for (t in TARGETS) runCatching { GlanceState.push(app, t.widget()) }
      } finally {
        if (hasWidgets(app)) schedule(app)
        pending.finish()
      }
    }
  }

  companion object {
    // Each Phase 3 widget task adds its entry here.
    val TARGETS: List<ClockTarget> = listOf(
      ClockTarget(ReciterSpotlightReceiver::class.java) { ReciterSpotlightWidget() },
      ClockTarget(AdhkarReceiver::class.java) { AdhkarWidget() },
      ClockTarget(BayaanNowReceiver::class.java) { BayaanNowWidget() },
    )

    fun hasWidgets(context: Context): Boolean {
      val manager = AppWidgetManager.getInstance(context)
      return TARGETS.any { manager.getAppWidgetIds(ComponentName(context, it.receiver)).isNotEmpty() }
    }

    fun schedule(context: Context) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val at = ContentLogic.nextBoundaryMs(System.currentTimeMillis(), TimeZone.getDefault()) + 1_000
      alarms.setAndAllowWhileIdle(AlarmManager.RTC, at, pendingIntent(context))
    }

    fun cancelIfUnused(context: Context) {
      if (hasWidgets(context)) return
      context.getSystemService(AlarmManager::class.java)?.cancel(pendingIntent(context))
    }

    private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
      context, 1, Intent(context, ContextClockReceiver::class.java),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }
}
