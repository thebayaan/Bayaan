// ayahoftheday/MidnightReceiver.kt
package expo.modules.bayaanwidgets.ayahoftheday

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.tasbeeh.TasbeehReceiver
import expo.modules.bayaanwidgets.tasbeeh.TasbeehWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.TimeZone

/**
 * Re-renders the date-driven widgets just after local midnight. Inexact and
 * permission free (setAndAllowWhileIdle); spec 7: no reliance on updatePeriodMillis.
 * Also runs on TIME_SET, TIMEZONE_CHANGED and DATE_CHANGED: the alarm is an absolute
 * wall-clock time, so any of those makes it stale. Every run pushes and re-arms.
 */
class MidnightReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    val app = context.applicationContext
    CoroutineScope(Dispatchers.Default).launch {
      try {
        runCatching { GlanceState.push(app, AyahOfTheDayWidget()) }
        runCatching { GlanceState.push(app, TasbeehWidget()) }
      } finally {
        if (hasWidgets(app)) schedule(app)
        pending.finish()
      }
    }
  }

  companion object {
    // Providers whose content changes at midnight.
    private val PROVIDERS: List<Class<*>> = listOf(AyahOfTheDayReceiver::class.java, TasbeehReceiver::class.java)

    fun hasWidgets(context: Context): Boolean {
      val manager = AppWidgetManager.getInstance(context)
      return PROVIDERS.any { manager.getAppWidgetIds(ComponentName(context, it)).isNotEmpty() }
    }

    fun schedule(context: Context) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val at = DayMath.nextLocalMidnightMs(System.currentTimeMillis(), TimeZone.getDefault()) + 1_000
      alarms.setAndAllowWhileIdle(AlarmManager.RTC, at, pendingIntent(context))
    }

    fun cancelIfUnused(context: Context) {
      if (hasWidgets(context)) return
      context.getSystemService(AlarmManager::class.java)?.cancel(pendingIntent(context))
    }

    private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
      context, 0, Intent(context, MidnightReceiver::class.java),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }
}
