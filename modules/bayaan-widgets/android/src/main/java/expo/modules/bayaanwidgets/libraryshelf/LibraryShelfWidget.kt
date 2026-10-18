// libraryshelf/LibraryShelfWidget.kt
package expo.modules.bayaanwidgets.libraryshelf

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
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentModels
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.LibraryShelfState
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.WidgetShelfItem
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.ShelfHeader
import expo.modules.bayaanwidgets.ui.SurahTile
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.appLink
import expo.modules.bayaanwidgets.ui.playPlaylistCommand
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork

class LibraryShelfWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.MEDIUM, WidgetSizes.LARGE))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val appWidgetId = GlanceState.appWidgetId(context, id)
    val stored = GlanceState.stored(context, appWidgetId)
    recordMissingArtwork(context, items(resolve(stored)).map { it.surahId }, emptyList())
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val state = remember(inputs) { resolve(inputs) }
      // A push after new artwork lands must redraw cards whose inputs did not change.
      key(inputs.pushedAt) { Content(context, appWidgetId, state) }
    }
  }

  private fun resolve(inputs: WidgetInputs): LibraryShelfState = ContentLogic.library(
    ContentConfigJson.decodeLibraryShelf(inputs.configJson).sourceId,
    inputs.contentJson?.let { ContentModels.decodeContent(it) },
  )

  private fun items(state: LibraryShelfState): List<WidgetShelfItem> = when (state) {
    is LibraryShelfState.Downloads -> state.items
    is LibraryShelfState.Playlist -> state.playlist.items
    else -> emptyList()
  }

  private fun configure(context: Context, appWidgetId: Int): Action = actionStartActivity(
    Intent(context, LibraryShelfConfigActivity::class.java)
      .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
      .setData(Uri.parse("bayaan-widget://configure/library/$appWidgetId")),
  )

  @Composable
  private fun Content(context: Context, appWidgetId: Int, state: LibraryShelfState) {
    val large = LocalSize.current.height >= WidgetSizes.LARGE.height
    when (state) {
      is LibraryShelfState.Downloads -> {
        val root = contentRoot().clickable(appLink(context, "collection/downloads"))
        if (state.items.isEmpty()) {
          ContentMessage(root, "No downloads yet", "Downloaded surahs show here")
          return
        }
        Shelf(context, root, large, { ShelfHeader("Downloads", ContentLogic.surahCount(state.count)) }, state.items) { item ->
          commandAction(context, playTrackCommand(item.surahId, item.reciterId, item.rewayatId, null),
            "library/downloads/${item.surahId}/${item.reciterId}/${item.rewayatId ?: "any"}")
        }
      }
      is LibraryShelfState.Playlist -> {
        val p = state.playlist
        val root = contentRoot().clickable(appLink(context, "collection/playlists"))
        val playAll = commandAction(context, playPlaylistCommand(p.id, null), "library/playlist/${p.id}")
        val header: @Composable () -> Unit = {
          ShelfHeader(p.name, ContentLogic.surahCount(p.itemCount)) { RoundButton(android.R.drawable.ic_media_play, "Play ${p.name}", playAll) }
        }
        if (p.items.isEmpty()) {
          Column(root.padding(14.dp)) {
            header()
            Spacer(GlanceModifier.defaultWeight())
            Text("Open the playlist in ${AppBrand.name(context)}", style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 12.sp))
            Spacer(GlanceModifier.defaultWeight())
          }
          return
        }
        Shelf(context, root, large, header, p.items) { item ->
          commandAction(context, playPlaylistCommand(p.id, item.itemId), "library/playlist/${p.id}/${item.itemId}")
        }
      }
      LibraryShelfState.PlaylistUnavailable ->
        ContentMessage(contentRoot().clickable(configure(context, appWidgetId)), "Playlist unavailable", "Tap to choose another")
      LibraryShelfState.NoContent -> ContentMessage(contentRoot().clickable(appLink(context, "")), "Open ${AppBrand.name(context)}", "to load your library")
    }
  }

  @Composable
  private fun Shelf(
    context: Context, root: GlanceModifier, large: Boolean, header: @Composable () -> Unit,
    items: List<WidgetShelfItem>, action: (WidgetShelfItem) -> Action,
  ) {
    Column(root.padding(14.dp)) {
      header()
      Spacer(GlanceModifier.height(10.dp))
      items.take(if (large) 8 else 4).chunked(4).forEach { row ->
        Row(GlanceModifier.fillMaxWidth().padding(bottom = 8.dp)) {
          row.forEachIndexed { i, item ->
            if (i > 0) Spacer(GlanceModifier.defaultWeight())
            SurahTile(context, item.surahId, if (large) 48 else 44, action(item), if (large) item.surahName else null)
          }
        }
      }
    }
  }
}
