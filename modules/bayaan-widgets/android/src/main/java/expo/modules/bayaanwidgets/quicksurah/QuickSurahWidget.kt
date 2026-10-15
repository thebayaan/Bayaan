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
import expo.modules.bayaanwidgets.ui.Logo
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

  @Composable
  private fun Content(
    context: Context, surahs: List<StaticSurah>, reciterId: String?, reciterName: String,
    photoId: String?, photoFile: String?,
  ) {
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
    val first = surahs.firstOrNull()
    if (first == null) {
      Box(root.padding(14.dp), contentAlignment = Alignment.Center) {
        Text("Open ${AppBrand.name(context)} to set up", style = TextStyle(color = WidgetColors.WHITE, fontWeight = FontWeight.Medium))
      }
      return
    }
    if (LocalSize.current.width >= WidgetSizes.MEDIUM.width) {
      Column(root.padding(12.dp)) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Text(reciterName, maxLines = 1, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Bold))
          Spacer(GlanceModifier.defaultWeight())
          Logo(14)
        }
        Spacer(GlanceModifier.height(8.dp))
        Row(GlanceModifier.fillMaxWidth()) { Tile(context, surahs.getOrNull(0), reciterId); Tile(context, surahs.getOrNull(1), reciterId) }
        Spacer(GlanceModifier.height(8.dp))
        Row(GlanceModifier.fillMaxWidth()) { Tile(context, surahs.getOrNull(2), reciterId); Tile(context, surahs.getOrNull(3), reciterId) }
      }
      return
    }
    val play = commandAction(context, playTrackCommand(first.id, reciterId, null, null), "quick/${first.id}/${reciterId ?: "default"}")
    Column(root.padding(14.dp).clickable(play)) {
      Row(GlanceModifier.fillMaxWidth()) {
        SurahCard(context, first, 52)
        Spacer(GlanceModifier.defaultWeight())
        Logo(14)
      }
      Spacer(GlanceModifier.defaultWeight())
      Text(first.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
      Spacer(GlanceModifier.height(4.dp))
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (photoId != null) {
          ReciterPhoto(context, photoFile, reciterName, 18, 18, 9)
          Spacer(GlanceModifier.width(6.dp))
        }
        Text(reciterName, maxLines = 1, modifier = GlanceModifier.defaultWeight(), style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
        RoundButton(android.R.drawable.ic_media_play, "Play ${first.name}", play)
      }
    }
  }

  @Composable
  private fun RowScope.Tile(context: Context, surah: StaticSurah?, reciterId: String?) {
    if (surah == null) {
      Spacer(GlanceModifier.defaultWeight())
      return
    }
    val play = commandAction(context, playTrackCommand(surah.id, reciterId, null, null), "quick/${surah.id}/${reciterId ?: "default"}")
    Row(
      GlanceModifier.defaultWeight().semantics { contentDescription = "Play ${surah.name}" }.clickable(play),
      verticalAlignment = Alignment.CenterVertically) {
      SurahCard(context, surah, 36)
      Spacer(GlanceModifier.width(8.dp))
      Text(surah.name, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Bold))
    }
  }
}
