// bedtime/BedtimeWidget.kt
package expo.modules.bayaanwidgets.bedtime

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
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
import expo.modules.bayaanwidgets.BedtimeConfig
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetFeatures
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.clockTime
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.recordMissingArtwork
import expo.modules.bayaanwidgets.ui.startBedtimeCommand

class BedtimeWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    recordMissingArtwork(context, listOf(ContentConfigJson.decodeBedtime(stored.configJson).surahId), emptyList())
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      // A push after new artwork lands must redraw the card whose inputs did not change.
      key(inputs.pushedAt) { BedtimeContent(context, ContentConfigJson.decodeBedtime(inputs.configJson), inputs) }
    }
  }
}

/** The Bedtime widget body; Bayaan Now shows it with ContentConfigJson.DEFAULT_BEDTIME. */
@Composable
fun BedtimeContent(context: Context, configured: BedtimeConfig, inputs: WidgetInputs) {
  // Without ambient audio (RFC-021) a stored sound is neither shown nor sent.
  val config = if (WidgetFeatures.ambient(context)) configured else configured.copy(ambient = null)
  val content = remember(inputs.contentJson) { inputs.contentJson?.let { ContentModels.decodeContent(it) } }
  val catalog = remember(inputs.catalogJson) { inputs.catalogJson?.let { CatalogModels.decode(it) } }
  val snapshot = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) } }
  val surah = StaticData.surah(context, config.surahId)
  val reciterName = catalog?.reciter(config.reciterId)?.name ?: snapshot?.defaultReciter?.name
  val sleepAt = content?.sleepTimerEndsAt?.takeIf { ContentLogic.sleepActive(it, System.currentTimeMillis()) }
  val detail = listOfNotNull("${config.minutes} min", config.ambient?.let { ContentConfigJson.ambientLabel(it) }).joinToString(" · ")
  val action = commandAction(context, startBedtimeCommand(config),
    "bedtime/${config.surahId}/${config.reciterId ?: "default"}/${config.minutes}/${config.ambient ?: "off"}")
  val small = LocalSize.current.width < WidgetSizes.MEDIUM.width
  val subtitle = sleepAt?.let { "Sleep at ${clockTime(context, it)}" } ?: if (small) "${surah?.name ?: ""} · $detail" else detail
  val root = contentRoot().clickable(action)
  if (small) {
    Column(root.padding(12.dp)) {
      Row(GlanceModifier.fillMaxWidth()) {
        SurahCard(context, surah, 54)
        Spacer(GlanceModifier.defaultWeight())
        Logo(12)
      }
      Spacer(GlanceModifier.defaultWeight())
      Text("Bedtime", style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Text(subtitle, maxLines = 2, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 11.sp))
        RoundButton(R.drawable.widget_moon, "Start bedtime", action)
      }
    }
    return
  }
  Row(root.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
    SurahCard(context, surah, 96)
    Spacer(GlanceModifier.width(12.dp))
    Column(GlanceModifier.defaultWeight()) {
      Row(GlanceModifier.fillMaxWidth()) {
        Text("Bedtime", modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
        Logo(14)
      }
      Text(surah?.name ?: "", maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      if (reciterName != null) {
        Text(reciterName, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 13.sp))
      }
      Spacer(GlanceModifier.height(6.dp))
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Text(subtitle, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
        RoundButton(R.drawable.widget_moon, "Start bedtime", action)
      }
    }
  }
}
