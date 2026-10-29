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
import expo.modules.bayaanwidgets.PlaybackState
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.WidgetTrack
import expo.modules.bayaanwidgets.ui.Eyebrow
import expo.modules.bayaanwidgets.WidgetText
import expo.modules.bayaanwidgets.ui.PrimaryButton
import expo.modules.bayaanwidgets.ui.ReciterSurahRow
import expo.modules.bayaanwidgets.ui.WidgetPalette
import expo.modules.bayaanwidgets.ui.playOrPause
import expo.modules.bayaanwidgets.ui.playingTrack
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.unit.ColorProvider
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
      val playing = playingTrack(context, inputs.snapshotJson?.let { SnapshotModels.decode(it) }) // @ai
      key(inputs.pushedAt) { Content(context, reciter, playing) } // @ai
    }
  }

  // ContextClockReceiver pushes at midnight, so "today" is re-read then.
  private fun resolve(inputs: WidgetInputs): WidgetSpotlightReciter? = ContentLogic.spotlight(
    inputs.contentJson?.let { ContentModels.decodeContent(it) }, System.currentTimeMillis(), TimeZone.getDefault(),
  )

  // @ai-start
  @Composable
  private fun Content(context: Context, r: WidgetSpotlightReciter?, playing: WidgetTrack?) {
    val root = GlanceModifier.fillMaxSize().background(ColorProvider(WidgetPalette.RECITER)).cornerRadius(20.dp)
    if (r == null) {
      ContentMessage(root.clickable(appLink(context, "")), "Open ${AppBrand.name(context)}", "to meet today's reciter")
      return
    }
    val isPlaying = playing?.reciterId == r.id
    val play = playOrPause(context, isPlaying, commandAction(context, playReciterCommand(r.id), "spotlight/${r.id}"))
    if (LocalSize.current.width < WidgetSizes.MEDIUM.width) {
      val size = LocalSize.current
      Box(root.clickable(play)) {
        ReciterPhoto(context, r.artworkFile, r.name, size.width.value.toInt(), size.height.value.toInt(), 20)
        Image(ImageProvider(R.drawable.widget_scrim_ink), contentDescription = null,
          modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
        // The button sits top right, so the label and name get the full width.
        Column(GlanceModifier.fillMaxSize().padding(10.dp)) {
          Row(GlanceModifier.fillMaxWidth()) {
            Spacer(GlanceModifier.defaultWeight())
            PrimaryButton(isPlaying, "Play ${r.name}", action = null, sizeDp = 34)
          }
          Spacer(GlanceModifier.defaultWeight())
          Text(SPOTLIGHT_LABEL, maxLines = 1, modifier = GlanceModifier.padding(horizontal = 2.dp),
            style = TextStyle(color = ColorProvider(WidgetPalette.GOLD), fontSize = 10.sp, fontWeight = FontWeight.Bold))
          Text(r.name, maxLines = 2, modifier = GlanceModifier.padding(horizontal = 2.dp),
            style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
        }
      }
      return
    }
    Row(root.padding(12.dp)) {
      ReciterPhoto(context, r.artworkFile, r.name, 86, 86, 14)
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        // Beside the name, clear of the photo's initials.
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Column(GlanceModifier.defaultWeight()) {
            Text(SPOTLIGHT_LABEL, maxLines = 1,
              style = TextStyle(color = ColorProvider(WidgetPalette.GOLD), fontSize = 10.sp, fontWeight = FontWeight.Bold))
            // Beside the photo and button: drop leading words rather than cut mid-word. // @ai
            Text(WidgetText.fitName(r.name, maxOf(6, (LocalSize.current.width.value.toInt() - 176) / 8)), maxLines = 1, // @ai
              style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
          }
          Spacer(GlanceModifier.width(8.dp)) // @ai
          PrimaryButton(isPlaying, "Play ${r.name}", play, sizeDp = 34)
        }
        // A 110 dp cell has room for one row: the playing surah if it is listed. // @ai
        (if (WidgetSizes.isShort(LocalSize.current)) { // @ai
          listOfNotNull(r.surahIds.firstOrNull { PlaybackState.matches(playing, it, r.id) } ?: r.surahIds.firstOrNull()) // @ai
        } else r.surahIds).forEach { id ->
          val surah = StaticData.surah(context, id) ?: return@forEach
          val rowPlaying = PlaybackState.matches(playing, id, r.id)
          val action = playOrPause(context, rowPlaying, commandAction(context, playTrackCommand(id, r.id, null, null), "spotlight/${r.id}/$id"))
          ReciterSurahRow(context, surah, rowPlaying, action)
        }
      }
    }
  }
  // @ai-end
}

/** Short enough for the small widget and beside the medium button; "Reciter of the Day" did not fit. */ // @ai
private const val SPOTLIGHT_LABEL = "Today's reciter" // @ai
