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
import androidx.glance.layout.Box
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
import expo.modules.bayaanwidgets.AdhkarSessionLogic
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentStaticData
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.WidgetText
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.ui.PrimaryButton
import expo.modules.bayaanwidgets.ui.adhkarListenAction
import expo.modules.bayaanwidgets.ui.adhkarPlaying
import androidx.glance.background
import androidx.glance.layout.width
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.appLink
import java.util.TimeZone

class AdhkarWidget : GlanceAppWidget() {
  /** Exact: Responsive reports the bucket (250x250 on a ~266x344 dp large), so the session sized its Arabic too small. */
  override val sizeMode = SizeMode.Exact
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
  val root = contentRoot().clickable(appLink(context, "adhkar/${data.superId}"))
  // @ai-start
  val listening = adhkarPlaying(WidgetStorage.readSnapshotJson(context)?.let { SnapshotModels.decode(it) }, data.superId)
  // @ai-end
  if (size.width < WidgetSizes.MEDIUM.width) {
    // The small layout keeps the Responsive bucket it was designed for.
    val bucket = if (size.height >= WidgetSizes.SMALL_TALL.height) WidgetSizes.SMALL_TALL else WidgetSizes.SMALL
    // @ai-start
    val style = AdhkarStyle.forPeriod(data.period)
    Column(root.background(style.color(style.background)).padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        PeriodIcon(style, 15)
        Spacer(GlanceModifier.width(6.dp))
        // Drops "Adhkar" before cutting letters; the icon already says which.
        Text(WidgetText.fitTitle(data.title, (size.width.value.toInt() - 45) / 8), maxLines = 1, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = style.color(style.primary), fontSize = 13.sp, fontWeight = FontWeight.Bold))
      }
      Spacer(GlanceModifier.defaultWeight())
      ArabicText(context, dhikr.arabic, ArabicBitmap.DHIKR_FONT, bucket.width.value - 24, bucket.height.value - 24 - 20 - 30, 20f, 11f, 2, center = true,
        color = style.primary, wholeLines = true)
      Spacer(GlanceModifier.defaultWeight())
      // Plays the period's adhkar audio from this dhikr, even with the app closed; pauses while it plays.
      Row(GlanceModifier.fillMaxWidth()) {
        Spacer(GlanceModifier.defaultWeight())
        PrimaryButton(listening, "Listen", adhkarListenAction(context, listening, data.superId, dhikr.id), sizeDp = 28,
          fill = style.color(style.accent), glyph = style.color(style.onAccent))
      }
    // @ai-end
    }
    return
  }
  val ids = data.items.map { it.id }
  val session = AdhkarSessionLogic.resolve(
    AdhkarSessionLogic.decode(WidgetStorage.readAdhkarSessionJson(context)),
    data.period, AdhkarSessionLogic.sessionDay(nowMs, tz), data.items.map { it.repeatCount },
  )
  val link = appLink(context, AdhkarSessionLogic.link(data.superId, session, ids))
  Box(contentRoot().clickable(link)) {
    AdhkarSessionContent(context, data, session, large = size.height >= WidgetSizes.LARGE.height, listening = listening) // @ai
  }
}
