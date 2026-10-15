// hijri/OccasionWidget.kt
package expo.modules.bayaanwidgets.hijri

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
import androidx.glance.layout.width
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
import expo.modules.bayaanwidgets.IcuHijri
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.appLink
import expo.modules.bayaanwidgets.ui.playTrackCommand
import java.util.TimeZone

class OccasionWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.MEDIUM, WidgetSizes.MEDIUM_TALL, WidgetSizes.LARGE))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      // Keyed on pushedAt so a ContextClockReceiver push recomposes with the new time.
      key(inputs.pushedAt) { OccasionContent(context, System.currentTimeMillis()) }
    }
  }
}

/** The Occasion widget body; also Bayaan Now's medium occasion mode. */
@Composable
fun OccasionContent(context: Context, nowMs: Long) {
  val tz = TimeZone.getDefault()
  val data = ContentStaticData.occasions(context)
  val hijri = ContentLogic.hijri(nowMs, tz, IcuHijri)
  if (data == null || hijri == null) {
    ContentMessage(contentRoot().clickable(appLink(context, "")), "Open ${AppBrand.name(context)}", null)
    return
  }
  val size = LocalSize.current
  val large = size.height >= WidgetSizes.LARGE.height
  val tall = size.height >= WidgetSizes.MEDIUM_TALL.height
  val hijriText = ContentLogic.hijriLine(hijri, data.months)
  val occasion = data.occasion(ContentLogic.occasionAt(nowMs, tz, IcuHijri))
  val ayah = occasion?.ayat?.getOrNull(DayMath.ayahIndex(nowMs, tz, occasion.ayat.size))
  if (occasion != null && ayah != null) {
    // Jumu'ah plays Surah Al-Kahf from the start; other occasions play from the ayah onward.
    val command = occasion.listenSurahId?.let { playTrackCommand(it, null, null, 1) }
      ?: playTrackCommand(ayah.surahId, null, null, ayah.ayah)
    val listenLabel = if (occasion.listenSurahId == null) "Listen" else "Listen to Al-Kahf"
    val listen = commandAction(context, command, "occasion/${occasion.id}/${ayah.key}")
    val open = appLink(context, "quran/${ayah.surahId}?ayah=${ayah.ayah}")
    val pad = if (large) 16 else 14
    Column(contentRoot().padding(pad.dp).clickable(open)) {
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        RoundButton(android.R.drawable.ic_media_play, listenLabel, listen)
        Spacer(GlanceModifier.width(8.dp))
        Column(GlanceModifier.defaultWeight()) {
          Text(occasion.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
          Text(hijriText, maxLines = 1, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp))
        }
        Logo(14)
      }
      if (large) Spacer(GlanceModifier.defaultWeight()) else Spacer(GlanceModifier.height(6.dp))
      ArabicText(context, ayah.arabic, ArabicBitmap.QURAN_FONT, size.width.value - pad * 2,
        if (large) 130f else if (tall) 80f else 44f, if (large) 32f else 24f, 12f, if (large) 6 else if (tall) 3 else 2, center = true)
      Spacer(GlanceModifier.height(4.dp))
      Text(ayah.translation, maxLines = if (large) 4 else if (tall) 3 else 2,
        style = TextStyle(color = WidgetColors.SECONDARY, fontSize = if (large) 14.sp else 12.sp))
      if (large) Spacer(GlanceModifier.defaultWeight())
    }
    return
  }
  val upcoming = ContentLogic.nextOccasions(DayMath.dayNumber(nowMs, tz), if (large) 3 else 2, IcuHijri)
  Column(contentRoot().padding(14.dp).clickable(appLink(context, ""))) {
    Row(GlanceModifier.fillMaxWidth()) {
      Text(hijriText, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
        style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      Logo(14)
    }
    Spacer(GlanceModifier.height(8.dp))
    Text("Coming up", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
    upcoming.forEach { u ->
      Row(GlanceModifier.fillMaxWidth().padding(top = 6.dp)) {
        Text(data.occasion(u.id)?.name ?: u.id, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Medium))
        Text(ContentLogic.daysLabel(u.days), style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
      }
    }
  }
}
