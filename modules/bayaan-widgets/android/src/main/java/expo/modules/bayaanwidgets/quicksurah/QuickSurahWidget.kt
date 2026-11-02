// quicksurah/QuickSurahWidget.kt
package expo.modules.bayaanwidgets.quicksurah

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
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.RowScope
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.StaticSurah
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.PlaybackState
import expo.modules.bayaanwidgets.WidgetText
import expo.modules.bayaanwidgets.WidgetTrack
import expo.modules.bayaanwidgets.ui.PrimaryButton
import expo.modules.bayaanwidgets.ui.SurahTile
import expo.modules.bayaanwidgets.ui.SurahTint
import expo.modules.bayaanwidgets.ui.WidgetPalette
import expo.modules.bayaanwidgets.ui.playOrPause
import expo.modules.bayaanwidgets.ui.playingTrack
import expo.modules.bayaanwidgets.ui.surahCardShowsName
import androidx.glance.unit.ColorProvider
import expo.modules.bayaanwidgets.ui.ReciterPhoto
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork

class QuickSurahWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    recordArtwork(context, stored)
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val config = remember(inputs.configJson) { WidgetConfigJson.decodeQuickSurah(inputs.configJson) }
      val catalog = remember(inputs.catalogJson) { inputs.catalogJson?.let { CatalogModels.decode(it) } }
      val snapshot = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) } }
      val reciter = catalog?.reciter(config.reciterId)
      // A push after new artwork lands must redraw cards whose inputs did not change.
      key(inputs.pushedAt) {
        Content(
          context,
          surahs = config.surahIds.mapNotNull { StaticData.surah(context, it) },
          reciterId = reciter?.id,
          reciterName = reciter?.name ?: snapshot?.defaultReciter?.name ?: "Default reciter",
          photoId = reciter?.id ?: snapshot?.defaultReciter?.id,
          photoFile = reciter?.artworkFile ?: snapshot?.defaultReciter?.artworkFile,
          playing = playingTrack(context, snapshot), // @ai
        )
      }
    }
  }

  /** Asks the app for the cards and reciter photo this widget is about to show. */
  private fun recordArtwork(context: Context, stored: WidgetInputs) {
    val config = WidgetConfigJson.decodeQuickSurah(stored.configJson)
    val catalog = stored.catalogJson?.let { CatalogModels.decode(it) }
    val snapshot = stored.snapshotJson?.let { SnapshotModels.decode(it) }
    val reciter = catalog?.reciter(config.reciterId)
    val shown = reciter?.let { it.id to it.artworkFile } ?: snapshot?.defaultReciter?.let { it.id to it.artworkFile }
    recordMissingArtwork(context, config.surahIds, listOfNotNull(shown))
  }

  // @ai-start
  @Composable
  private fun Content(
    context: Context, surahs: List<StaticSurah>, reciterId: String?, reciterName: String,
    photoId: String?, photoFile: String?, playing: WidgetTrack?,
  ) {
    val first = surahs.firstOrNull()
    val small = LocalSize.current.width < WidgetSizes.MEDIUM.width
    val tint = if (small && first != null) SurahTint.deep(first.id) else WidgetPalette.INK
    val root = GlanceModifier.fillMaxSize().background(ColorProvider(tint)).cornerRadius(20.dp)
    if (first == null) {
      Box(root.padding(14.dp), contentAlignment = Alignment.Center) {
        Text("Open ${AppBrand.name(context)} to set up", style = TextStyle(color = WidgetColors.WHITE, fontWeight = FontWeight.Medium))
      }
      return
    }
    // A tile pauses its surah while it plays from the shown reciter (or any, for the default).
    val playingId = surahs.firstOrNull { PlaybackState.matches(playing, it.id, reciterId) }?.id
    if (!small) {
      Column(root.padding(horizontal = 14.dp, vertical = 10.dp)) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          if (photoId != null) {
            ReciterPhoto(context, photoFile, reciterName, 20, 20, 10)
            Spacer(GlanceModifier.width(8.dp))
          }
          Text("with $reciterName", maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Medium))
        }
        Spacer(GlanceModifier.height(10.dp))
        Row(GlanceModifier.fillMaxWidth()) {
          for (i in 0 until 4) Tile(context, surahs.getOrNull(i), reciterId, surahs.getOrNull(i)?.id == playingId)
        }
      }
      return
    }
    val isPlaying = playingId == first.id
    val play = commandAction(context, playTrackCommand(first.id, reciterId, null, null), "quick/${first.id}/${reciterId ?: "default"}")
    // A cached card prints the surah name, so it is shown larger and not repeated;
    // generated art gets the title beside it.
    val cardNamed = surahCardShowsName(context, first)
    val widthDp = LocalSize.current.width.value.toInt()
    val reciterLine = WidgetText.fitName(reciterName, maxOf(6, (widthDp - 60) / 7))
    if (!cardNamed) {
      // Generated art: card and button on top, so the title gets the full width below.
      Column(root.padding(12.dp).clickable(playOrPause(context, isPlaying, play))) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          SurahCard(context, first, 36)
          Spacer(GlanceModifier.defaultWeight())
          PrimaryButton(isPlaying, "Play ${first.name}", action = null, sizeDp = 32)
        }
        Spacer(GlanceModifier.defaultWeight())
        Text(first.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
        Text(reciterLine, maxLines = 1,
          style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Medium))
      }
      return
    }
    Column(root.padding(12.dp).clickable(playOrPause(context, isPlaying, play))) {
      SurahCard(context, first, 52)
      Spacer(GlanceModifier.defaultWeight())
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(reciterLine, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Medium))
        Spacer(GlanceModifier.width(4.dp))
        PrimaryButton(isPlaying, "Play ${first.name}", action = null, sizeDp = 32)
      }
    }
  }

  /** One tap per tile: the tile is the play button. */
  @Composable
  private fun RowScope.Tile(context: Context, surah: StaticSurah?, reciterId: String?, playing: Boolean) {
    if (surah == null) {
      Spacer(GlanceModifier.defaultWeight())
      return
    }
    val play = commandAction(context, playTrackCommand(surah.id, reciterId, null, null), "quick/${surah.id}/${reciterId ?: "default"}")
    Column(
      GlanceModifier.defaultWeight().semantics { contentDescription = if (playing) "Pause" else "Play ${surah.name}" },
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      SurahTile(context, surah.id, 48, play, caption = surah.name, playing = playing)
    }
  }
  // @ai-end
}
