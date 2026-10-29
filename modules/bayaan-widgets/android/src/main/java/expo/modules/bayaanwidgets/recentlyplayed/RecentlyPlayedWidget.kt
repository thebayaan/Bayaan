// recentlyplayed/RecentlyPlayedWidget.kt
package expo.modules.bayaanwidgets.recentlyplayed

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
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
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.RecentShelf
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.PlaybackState
import expo.modules.bayaanwidgets.WidgetTrack
import expo.modules.bayaanwidgets.ui.playingTrack
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.ShelfHeader
import expo.modules.bayaanwidgets.ui.SurahTile
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.appLink
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork

class RecentlyPlayedWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.MEDIUM, WidgetSizes.LARGE))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    recordMissingArtwork(context, shelf(stored).tracks.map { it.surahId }, emptyList())
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val shelf = remember(inputs) { shelf(inputs) }
      // A push after new artwork lands must redraw cards whose inputs did not change.
      val playing = playingTrack(context, inputs.snapshotJson?.let { SnapshotModels.decode(it) }) // @ai
      key(inputs.pushedAt) { Content(context, shelf, playing) } // @ai
    }
  }

  private fun shelf(inputs: WidgetInputs): RecentShelf =
    ContentLogic.recentShelf(inputs.snapshotJson?.let { SnapshotModels.decode(it) })

  @Composable
  private fun Content(context: Context, shelf: RecentShelf, playing: WidgetTrack?) { // @ai
    val large = LocalSize.current.height >= WidgetSizes.LARGE.height
    val short = WidgetSizes.isShort(LocalSize.current) // @ai
    val root = contentRoot().clickable(appLink(context, "player"))
    if (shelf.tracks.isEmpty()) {
      ContentMessage(root, "Open ${AppBrand.name(context)}", "Your recent surahs show here")
      return
    }
    Column(root.padding((if (short) 12 else 14).dp)) { // @ai
      ShelfHeader(if (shelf.isSuggestion) "Start listening" else "Recently Played", null, compact = short) // @ai
      Spacer(GlanceModifier.height((if (short) 6 else 10).dp)) // @ai
      shelf.tracks.take(if (large) 6 else 4).chunked(if (large) 3 else 4).forEach { row ->
        Row(GlanceModifier.fillMaxWidth().padding(bottom = 8.dp)) {
          row.forEachIndexed { i, t ->
            if (i > 0) Spacer(GlanceModifier.defaultWeight())
            val action = commandAction(context, playTrackCommand(t.surahId, t.reciterId, t.rewayatId, null),
              "recent/${t.surahId}/${t.reciterId}/${t.rewayatId ?: "any"}")
            SurahTile(context, t.surahId, if (large) 72 else if (short) 46 else 52, action, if (large) t.reciterName else null, // @ai
              playing = PlaybackState.matches(playing, t.surahId, t.reciterId)) // @ai
          }
        }
      }
    }
  }
}
