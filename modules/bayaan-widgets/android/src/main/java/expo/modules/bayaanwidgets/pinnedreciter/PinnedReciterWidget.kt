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
      key(inputs.pushedAt) { Content(context, appWidgetId, state) }
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
  private fun Content(context: Context, appWidgetId: Int, state: PinnedReciterState) {
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
    when (state) {
      is PinnedReciterState.Ready ->
        if (LocalSize.current.width >= WidgetSizes.MEDIUM.width) Medium(context, state, root) else Small(context, state, root)
      PinnedReciterState.Unavailable -> Message(context, appWidgetId, root, "Reciter unavailable", "Tap to choose another")
      PinnedReciterState.Unset -> Message(context, appWidgetId, root, "Choose a reciter", "Tap to pick one")
    }
  }

  @Composable
  private fun Small(context: Context, state: PinnedReciterState.Ready, root: GlanceModifier) {
    val play = commandAction(context, playReciterCommand(state.id), "reciter/${state.id}")
    val size = LocalSize.current
    Box(root.clickable(play)) {
      ReciterPhoto(context, state.artworkFile, state.name, size.width.value.toInt(), size.height.value.toInt(), 20)
      Image(
        ImageProvider(R.drawable.widget_scrim), contentDescription = null,
        modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.FillBounds,
      )
      Column(GlanceModifier.fillMaxSize().padding(12.dp)) {
        Row(GlanceModifier.fillMaxWidth()) {
          Spacer(GlanceModifier.defaultWeight())
          Logo(14)
        }
        Spacer(GlanceModifier.defaultWeight())
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
          Text(state.name, maxLines = 2, modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
          RoundButton(android.R.drawable.ic_media_play, "Play ${state.name}", play)
        }
      }
    }
  }

  @Composable
  private fun Medium(context: Context, state: PinnedReciterState.Ready, root: GlanceModifier) {
    val play = commandAction(context, playReciterCommand(state.id), "reciter/${state.id}")
    Row(root.padding(12.dp)) {
      Box(GlanceModifier.width(86.dp).fillMaxHeight().clickable(play), contentAlignment = Alignment.BottomStart) {
        ReciterPhoto(context, state.artworkFile, state.name, 86, 86, 14)
        Box(GlanceModifier.padding(6.dp)) { RoundButton(android.R.drawable.ic_media_play, "Play ${state.name}", play) }
      }
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Text(state.name, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
          Logo(14)
        }
        state.rows.forEach { row ->
          val surah = StaticData.surah(context, row.surahId) ?: return@forEach
          val action = commandAction(context, playTrackCommand(row.surahId, state.id, row.rewayatId, null),
            "reciter/${state.id}/${row.surahId}/${row.rewayatId ?: "any"}")
          Row(GlanceModifier.fillMaxWidth().padding(top = 6.dp).clickable(action), verticalAlignment = Alignment.CenterVertically) {
            SurahCard(context, surah, 24)
            Spacer(GlanceModifier.width(8.dp))
            Text(surah.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Medium))
          }
        }
      }
    }
  }

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
