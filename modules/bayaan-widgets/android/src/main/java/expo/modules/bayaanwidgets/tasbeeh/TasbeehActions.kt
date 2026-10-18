// tasbeeh/TasbeehActions.kt
package expo.modules.bayaanwidgets.tasbeeh

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.WidgetStorage
import java.util.TimeZone

object TasbeehActions {
  val DHIKR_ID = ActionParameters.Key<String>("dhikrId")
}

private suspend fun record(context: Context, parameters: ActionParameters, reset: Boolean) {
  val dhikrId = parameters[TasbeehActions.DHIKR_ID] ?: return
  WidgetStorage.addPendingTasbeeh(context, dhikrId, DayMath.localDayKey(System.currentTimeMillis(), TimeZone.getDefault()), reset)
  GlanceState.push(context, TasbeehWidget())
}

/** +1 in place: runs in the app process without JS or an activity. */
class IncrementTasbeehAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    record(context, parameters, reset = false)
}

class ResetTasbeehAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) =
    record(context, parameters, reset = true)
}
