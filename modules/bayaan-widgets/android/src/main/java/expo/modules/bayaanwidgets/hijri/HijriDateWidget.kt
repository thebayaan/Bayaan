// hijri/HijriDateWidget.kt
package expo.modules.bayaanwidgets.hijri

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
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
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.IcuHijri
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.appLink
import java.util.TimeZone

class HijriDateWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      // Keyed on pushedAt so a ContextClockReceiver push recomposes with the new time.
      key(inputs.pushedAt) { HijriSmallContent(context, System.currentTimeMillis()) }
    }
  }
}

/** The small Hijri date; also Bayaan Now's small occasion mode. Tapping opens the app. */
@Composable
fun HijriSmallContent(context: Context, nowMs: Long) {
  val tz = TimeZone.getDefault()
  val data = ContentStaticData.occasions(context)
  val hijri = ContentLogic.hijri(nowMs, tz, IcuHijri)
  val month = hijri?.let { data?.month(it.month) }
  val occasion = data?.occasion(ContentLogic.occasionAt(nowMs, tz, IcuHijri))
  Column(contentRoot().padding(12.dp).clickable(appLink(context, ""))) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      if (month != null) ArabicText(context, month.arabic, ArabicBitmap.DHIKR_FONT, 72f, 22f, 15f, 10f, 1, center = false)
      Spacer(GlanceModifier.defaultWeight())
      Logo(12)
    }
    Spacer(GlanceModifier.defaultWeight())
    if (hijri == null) {
      Text("Open ${AppBrand.name(context)}", style = TextStyle(color = WidgetColors.WHITE, fontSize = 12.sp, fontWeight = FontWeight.Bold))
    } else {
      Text(hijri.day.toString(), style = TextStyle(color = WidgetColors.WHITE, fontSize = 40.sp, fontWeight = FontWeight.Bold))
      Text("${month?.name ?: ""} ${hijri.year} AH", maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
    }
    if (occasion != null) {
      Text(occasion.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 11.sp, fontWeight = FontWeight.Bold))
    }
  }
}
