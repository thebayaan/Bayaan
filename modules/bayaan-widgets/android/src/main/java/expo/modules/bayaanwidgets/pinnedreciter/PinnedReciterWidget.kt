package expo.modules.bayaanwidgets.pinnedreciter

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
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
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
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
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.PlaybackState
import expo.modules.bayaanwidgets.WidgetTrack
import expo.modules.bayaanwidgets.ui.PrimaryButton
import expo.modules.bayaanwidgets.ui.ReciterSurahRow
import expo.modules.bayaanwidgets.ui.WidgetPalette
import expo.modules.bayaanwidgets.ui.playOrPause
import expo.modules.bayaanwidgets.ui.playingTrack
import androidx.glance.unit.ColorProvider
import expo.modules.bayaanwidgets.ui.ReciterPhoto
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.playReciterCommand
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork

class PinnedReciterWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val appWidgetId = GlanceState.appWidgetId(context, id)
    val stored = GlanceState.stored(context, appWidgetId)
    recordArtwork(context, stored)
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val state = remember(inputs) { resolve(inputs) }
      // A push after new artwork lands must redraw even when the state did not change.
      val playing = playingTrack(context, inputs.snapshotJson?.let { SnapshotModels.decode(it) }) // @ai
      key(inputs.pushedAt) { Content(context, appWidgetId, state, playing) } // @ai
    }
  }

  private fun resolve(inputs: WidgetInputs): PinnedReciterState = PinnedReciterModel.resolve(
    WidgetConfigJson.decodePinnedReciter(inputs.configJson),
    inputs.catalogJson?.let { CatalogModels.decode(it) },
    inputs.snapshotJson?.let { SnapshotModels.decode(it) },
  )

  /** Asks the app for the photo and surah cards this widget is about to show, at every size. */
  private fun recordArtwork(context: Context, stored: WidgetInputs) {
    val state = resolve(stored) as? PinnedReciterState.Ready ?: return
    recordMissingArtwork(context, state.rows.map { it.surahId }, listOf(state.id to state.artworkFile))
  }

  @Composable
  private fun Content(context: Context, appWidgetId: Int, state: PinnedReciterState, playing: WidgetTrack?) { // @ai
    val root = GlanceModifier.fillMaxSize().background(ColorProvider(WidgetPalette.RECITER)).cornerRadius(20.dp) // @ai
    when (state) {
      is PinnedReciterState.Ready ->
        if (LocalSize.current.width >= WidgetSizes.MEDIUM.width) Medium(context, state, root, playing) else Small(context, state, root, playing) // @ai
      PinnedReciterState.Unavailable -> Message(context, appWidgetId, root, "Reciter unavailable", "Tap to choose another")
      PinnedReciterState.Unset -> Message(context, appWidgetId, root, "Choose a reciter", "Tap to pick one")
    }
  }

  // @ai-start
  @Composable
  private fun Small(context: Context, state: PinnedReciterState.Ready, root: GlanceModifier, playing: WidgetTrack?) {
    val isPlaying = playing?.reciterId == state.id
    val play = playOrPause(context, isPlaying, commandAction(context, playReciterCommand(state.id), "reciter/${state.id}"))
    val size = LocalSize.current
    Box(root.clickable(play)) {
      ReciterPhoto(context, state.artworkFile, state.name, size.width.value.toInt(), size.height.value.toInt(), 20)
      Image(
        ImageProvider(R.drawable.widget_scrim_ink), contentDescription = null,
        modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.FillBounds,
      )
      // The button sits top right, so the name gets the full width and breaks between words.
      Column(GlanceModifier.fillMaxSize().padding(10.dp)) {
        Row(GlanceModifier.fillMaxWidth()) {
          Spacer(GlanceModifier.defaultWeight())
          PrimaryButton(isPlaying, "Play ${state.name}", action = null, sizeDp = 34)
        }
        Spacer(GlanceModifier.defaultWeight())
        Text(state.name, maxLines = 2, modifier = GlanceModifier.padding(horizontal = 2.dp),
          style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
      }
    }
  }

  @Composable
  private fun Medium(context: Context, state: PinnedReciterState.Ready, root: GlanceModifier, playing: WidgetTrack?) {
    val isPlaying = playing?.reciterId == state.id
    val play = playOrPause(context, isPlaying, commandAction(context, playReciterCommand(state.id), "reciter/${state.id}"))
    Row(root.padding(12.dp)) {
      ReciterPhoto(context, state.artworkFile, state.name, 86, 86, 14)
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        // The play button sits beside the name, clear of the photo's initials.
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Text(state.name, maxLines = 2, modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
          PrimaryButton(isPlaying, "Play ${state.name}", play, sizeDp = 34)
        }
        state.rows.forEach { row ->
          val surah = StaticData.surah(context, row.surahId) ?: return@forEach
          val rowPlaying = PlaybackState.matches(playing, row.surahId, state.id)
          val action = playOrPause(context, rowPlaying, commandAction(context, playTrackCommand(row.surahId, state.id, row.rewayatId, null),
            "reciter/${state.id}/${row.surahId}/${row.rewayatId ?: "any"}"))
          ReciterSurahRow(context, surah, rowPlaying, action)
        }
      }
    }
  }
  // @ai-end

  @Composable
  private fun Message(context: Context, appWidgetId: Int, root: GlanceModifier, title: String, detail: String) {
    val configure = actionStartActivity(
      Intent(context, PinnedReciterConfigActivity::class.java)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        .setData(Uri.parse("bayaan-widget://configure/reciter/$appWidgetId")),
    )
    Column(
      root.padding(12.dp).clickable(configure),
      horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically,
    ) {
      Logo(20)
      Spacer(GlanceModifier.height(6.dp))
      Text(title, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center))
      Text(detail, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, textAlign = TextAlign.Center))
    }
  }
}
