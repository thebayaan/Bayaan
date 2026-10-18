// spotlight/ReciterSpotlightWidget.kt
package expo.modules.bayaanwidgets.spotlight

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.WidgetSpotlightReciter
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.ReciterPhoto
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.appLink
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.playReciterCommand
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork
import java.util.TimeZone

class ReciterSpotlightWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    resolve(stored)?.let { recordMissingArtwork(context, it.surahIds, listOf(it.id to it.artworkFile)) }
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val reciter = remember(inputs) { resolve(inputs) }
      key(inputs.pushedAt) { Content(context, reciter) }
    }
  }

  // ContextClockReceiver pushes at midnight, so "today" is re-read then.
  private fun resolve(inputs: WidgetInputs): WidgetSpotlightReciter? = ContentLogic.spotlight(
    inputs.contentJson?.let { ContentModels.decodeContent(it) }, System.currentTimeMillis(), TimeZone.getDefault(),
  )

  @Composable
  private fun Content(context: Context, r: WidgetSpotlightReciter?) {
    if (r == null) {
      ContentMessage(contentRoot().clickable(appLink(context, "")), "Open ${AppBrand.name(context)}", "to meet today's reciter")
      return
    }
    val play = commandAction(context, playReciterCommand(r.id), "spotlight/${r.id}")
    if (LocalSize.current.width < WidgetSizes.MEDIUM.width) {
      val size = LocalSize.current
      Box(contentRoot().clickable(play)) {
        ReciterPhoto(context, r.artworkFile, r.name, size.width.value.toInt(), size.height.value.toInt(), 20)
        Image(ImageProvider(R.drawable.widget_scrim), contentDescription = null,
          modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
        Column(GlanceModifier.fillMaxSize().padding(12.dp)) {
          Row(GlanceModifier.fillMaxWidth()) {
            Spacer(GlanceModifier.defaultWeight())
            Logo(14)
          }
          Spacer(GlanceModifier.defaultWeight())
          Text("Reciter of the Day", style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 10.sp, fontWeight = FontWeight.Bold))
          Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Text(r.name, maxLines = 2, modifier = GlanceModifier.defaultWeight(),
              style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
            RoundButton(android.R.drawable.ic_media_play, "Play ${r.name}", play)
          }
        }
      }
      return
    }
    Row(contentRoot().padding(12.dp)) {
      Box(GlanceModifier.width(86.dp).fillMaxHeight().clickable(play), contentAlignment = Alignment.BottomStart) {
        ReciterPhoto(context, r.artworkFile, r.name, 86, 86, 14)
        Box(GlanceModifier.padding(6.dp)) { RoundButton(android.R.drawable.ic_media_play, "Play ${r.name}", play) }
      }
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        Row(GlanceModifier.fillMaxWidth()) {
          Column(GlanceModifier.defaultWeight()) {
            Text("Reciter of the Day", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 10.sp, fontWeight = FontWeight.Bold))
            Text(r.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
          }
          Logo(14)
        }
        r.surahIds.forEach { id ->
          val surah = StaticData.surah(context, id) ?: return@forEach
          val action = commandAction(context, playTrackCommand(id, r.id, null, null), "spotlight/${r.id}/$id")
          Row(GlanceModifier.fillMaxWidth().padding(top = 6.dp).clickable(action), verticalAlignment = Alignment.CenterVertically) {
            SurahCard(context, surah, 24)
            Spacer(GlanceModifier.width(8.dp))
            Text(surah.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Medium))
          }
        }
      }
    }
  }
}
