// adhkar/AdhkarSessionActions.kt
package expo.modules.bayaanwidgets.adhkar

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import expo.modules.bayaanwidgets.AdhkarSessionAction
import expo.modules.bayaanwidgets.AdhkarSessionLogic
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentStaticData
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.bayaannow.BayaanNowWidget
import java.util.TimeZone
import org.json.JSONObject

/** Applies one session action for the current period, records completion once, and refreshes both widgets that show it. */
internal object AdhkarSessionActions {
  @Synchronized
  fun apply(context: Context, action: AdhkarSessionAction, nowMs: Long = System.currentTimeMillis()): Boolean {
    val tz = TimeZone.getDefault()
    val data = ContentStaticData.adhkar(context)?.of(ContentLogic.adhkarPeriod(ContentLogic.hour(nowMs, tz))) ?: return false
    val counts = data.items.map { it.repeatCount }
    val before = AdhkarSessionLogic.resolve(
      AdhkarSessionLogic.decode(WidgetStorage.readAdhkarSessionJson(context)),
      data.period, AdhkarSessionLogic.sessionDay(nowMs, tz), counts,
    )
    val after = AdhkarSessionLogic.apply(action, before, counts, nowMs)
    WidgetStorage.writeAdhkarSession(context, AdhkarSessionLogic.encode(after))
    AdhkarSessionLogic.completionEvent(before, after, counts, data.superId, nowMs)?.let { c ->
      val props = JSONObject().put("category", c.category).put("duration_ms", c.durationMs).put("dhikr_count", c.dhikrCount)
      WidgetStorage.addPendingEvent(
        context,
        JSONObject().put("name", "adhkar_session_completed").put("props", props).put("completedAtMs", c.completedAtMs),
      )
    }
    return true
  }

  suspend fun run(context: Context, action: AdhkarSessionAction) {
    if (!apply(context, action)) return
    GlanceState.push(context, AdhkarWidget())
    GlanceState.push(context, BayaanNowWidget())
  }
}

class AdhkarNextAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    AdhkarSessionActions.run(context, AdhkarSessionAction.NEXT)
}

class AdhkarPrevAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    AdhkarSessionActions.run(context, AdhkarSessionAction.PREV)
}

class AdhkarCountAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    AdhkarSessionActions.run(context, AdhkarSessionAction.COUNT)
}

class AdhkarRestartAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    AdhkarSessionActions.run(context, AdhkarSessionAction.RESTART)
}
