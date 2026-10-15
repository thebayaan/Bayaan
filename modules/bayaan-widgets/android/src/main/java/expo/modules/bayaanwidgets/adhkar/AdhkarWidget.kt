// adhkar/AdhkarWidget.kt
package expo.modules.bayaanwidgets.adhkar

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentStaticData
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.appLink
import java.util.TimeZone

class AdhkarWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.SMALL_TALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      // Keyed on pushedAt so a ContextClockReceiver push recomposes with the new time.
      key(inputs.pushedAt) { AdhkarContent(context, System.currentTimeMillis()) }
    }
  }
}

/** The Adhkar widget body; also Bayaan Now's adhkar modes. */
@Composable
fun AdhkarContent(context: Context, nowMs: Long) {
  val tz = TimeZone.getDefault()
  val data = ContentStaticData.adhkar(context)?.of(ContentLogic.adhkarPeriod(ContentLogic.hour(nowMs, tz)))
  val dhikr = data?.featured?.getOrNull(DayMath.ayahIndex(nowMs, tz, data.featured.size))
  if (data == null || dhikr == null) {
    ContentMessage(contentRoot().clickable(appLink(context, "")), "Open ${AppBrand.name(context)}", null)
    return
  }
  val size = LocalSize.current
  val width = size.width.value
  val root = contentRoot().clickable(appLink(context, "adhkar/${data.superId}"))
  if (size.width < WidgetSizes.MEDIUM.width) {
    Column(root.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        ArabicText(context, data.arabicTitle, ArabicBitmap.DHIKR_FONT, width - 24 - 22, 22f, 15f, 10f, 1, center = true)
        Logo(12)
      }
      Spacer(GlanceModifier.defaultWeight())
      ArabicText(context, dhikr.arabic, ArabicBitmap.DHIKR_FONT, width - 24, size.height.value - 24 - 34, 22f, 11f, 3, center = true)
      Spacer(GlanceModifier.defaultWeight())
    }
    return
  }
  Column(root.padding(14.dp)) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text(data.title, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
        style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
      Logo(14)
    }
    Spacer(GlanceModifier.defaultWeight())
    ArabicText(context, dhikr.arabic, ArabicBitmap.DHIKR_FONT, width - 28, 50f, 22f, 11f, 2, center = true)
    if (dhikr.translation != null) {
      Text(dhikr.translation, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
    }
    Spacer(GlanceModifier.defaultWeight())
    Row(GlanceModifier.fillMaxWidth()) {
      Text(ContentLogic.repeatLabel(dhikr.repeatCount) ?: "", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
      Spacer(GlanceModifier.defaultWeight())
      Text("${data.count} adhkar", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
    }
  }
}
