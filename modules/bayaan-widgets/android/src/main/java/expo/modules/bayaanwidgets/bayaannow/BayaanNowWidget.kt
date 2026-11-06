// bayaannow/BayaanNowWidget.kt
package expo.modules.bayaanwidgets.bayaannow

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
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.BayaanNowMode
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetFeatures
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.WidgetSnapshot
import expo.modules.bayaanwidgets.adhkar.AdhkarContent
import expo.modules.bayaanwidgets.bedtime.BedtimeContent
import expo.modules.bayaanwidgets.ui.ContentMessage
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.WidgetText
import expo.modules.bayaanwidgets.ui.Eyebrow
import expo.modules.bayaanwidgets.ui.PrimaryButton
import expo.modules.bayaanwidgets.ui.SurahTint
import expo.modules.bayaanwidgets.ui.surahCardShowsName
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.fillMaxSize
import androidx.glance.unit.ColorProvider
import expo.modules.bayaanwidgets.ui.ReciterPhoto
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.contentRoot
import expo.modules.bayaanwidgets.ui.appLink
import expo.modules.bayaanwidgets.ui.playTrackCommand
import expo.modules.bayaanwidgets.ui.recordMissingArtwork
import org.json.JSONObject
import java.util.TimeZone

class BayaanNowWidget : GlanceAppWidget() {
  // MEDIUM_TALL gives a 3x2 or 4x2 adhkar session two lines instead of the compact one; listening and bedtime only check width.
  override val sizeMode = SizeMode.Responsive(
    setOf(WidgetSizes.SMALL, WidgetSizes.SMALL_TALL, WidgetSizes.MEDIUM, WidgetSizes.MEDIUM_TALL),
  )
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    val snapshot = stored.snapshotJson?.let { SnapshotModels.decode(it) }
    val track = snapshot?.nowPlaying?.track ?: snapshot?.recent?.firstOrNull() ?: snapshot?.upNext?.firstOrNull()
    recordMissingArtwork(
      context,
      listOfNotNull(track?.surahId?.takeIf { it in 1..114 }, ContentConfigJson.DEFAULT_BEDTIME_SURAH),
      emptyList(),
    )
    runCatching {
      BayaanNowTrackEndWorker.schedule(context, ContentLogic.trackEndMs(snapshot), System.currentTimeMillis())
    }
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      // A push after new artwork lands must redraw the card whose inputs did not change.
      key(inputs.pushedAt) { Content(context, inputs) }
    }
  }

  @Composable
  private fun Content(context: Context, inputs: WidgetInputs) {
    val now = System.currentTimeMillis()
    val tz = TimeZone.getDefault()
    val snapshot = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) } }
    val playing = ContentLogic.playingAt(snapshot, now)
    val mode = ContentLogic.mode(
      ContentLogic.hour(now, tz), playing,
      adhkar = WidgetFeatures.adhkar(context), bedtime = WidgetFeatures.sleepTimer(context),
    )
    when (mode) {
      BayaanNowMode.LISTENING -> NowPlayingCard(context, snapshot, now)
      BayaanNowMode.MORNING_ADHKAR, BayaanNowMode.EVENING_ADHKAR -> AdhkarContent(context, now)
      BayaanNowMode.BEDTIME -> BedtimeContent(context, ContentConfigJson.DEFAULT_BEDTIME, inputs)
    }
  }
}

/**
 * Bayaan Now's listening card. 1a's Continue Listening composables are private
 * and off limits (P3-R13), so this is a plain card: artwork, titles and a play
 * or pause button. It renders the snapshot state without the tap override.
 */
@Composable
fun NowPlayingCard(context: Context, snapshot: WidgetSnapshot?, nowMs: Long) {
  val np = snapshot?.nowPlaying
  val track = np?.track ?: snapshot?.recent?.firstOrNull() ?: snapshot?.upNext?.firstOrNull()
  val root = contentRoot().clickable(appLink(context, "player"))
  if (track == null) {
    ContentMessage(root, "Open ${AppBrand.name(context)}", "Start listening")
    return
  }
  val playing = ContentLogic.playingAt(snapshot, nowMs)
  val action = when {
    np != null -> commandAction(context, JSONObject().put("type", "setPlayback").put("playing", !playing), "now/playback/${!playing}")
    track.isUserUpload || track.surahId !in 1..114 -> appLink(context, "player")
    else -> commandAction(
      context, playTrackCommand(track.surahId, track.reciterId, track.rewayatId, null),
      "now/play/${track.surahId}/${track.reciterId}/${track.rewayatId ?: "any"}",
    )
  }
  // @ai-start
  val label = "Play"
  val surah = if (track.isUserUpload) null else StaticData.surah(context, track.surahId)
  val small = LocalSize.current.width < WidgetSizes.MEDIUM.width
  val short = WidgetSizes.isShort(LocalSize.current)
  // A cached card prints the surah name, so small shows it larger instead of a title.
  val cardNamed = surah != null && surahCardShowsName(context, surah)
  val art = if (small) (if (cardNamed) 52 else 40) else if (short) 80 else 92
  // Tinted by the surah, like Continue Listening.
  val tinted = GlanceModifier.fillMaxSize().background(ColorProvider(SurahTint.deep(surah?.id ?: 0))).cornerRadius(20.dp)
    .clickable(appLink(context, "player"))

  @Composable
  fun Art() {
    if (surah != null) SurahCard(context, surah, art) else ReciterPhoto(context, track.artworkFile, track.reciterName, art, art, art / 6)
  }

  if (small) {
    val widthDp = LocalSize.current.width.value.toInt()
    Column(tinted.padding(12.dp)) {
      if (cardNamed) {
        Art()
      } else {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Art()
          Spacer(GlanceModifier.width(8.dp))
          Text(track.surahName, maxLines = 2, modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
        }
      }
      Spacer(GlanceModifier.defaultWeight())
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
          WidgetText.fitName(track.reciterName, maxOf(6, (widthDp - 60) / 7)), maxLines = 1, modifier = GlanceModifier.defaultWeight(),
          style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Medium),
        )
        Spacer(GlanceModifier.width(4.dp))
        PrimaryButton(playing, label, action, sizeDp = 32)
      }
    }
    return
  }
  // The button sits beside the titles, so a 110 dp tall cell still fits it.
  Row(tinted.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
    Art()
    Spacer(GlanceModifier.width(12.dp))
    Column(GlanceModifier.defaultWeight()) {
      Eyebrow(if (playing) "Now playing" else "Continue listening")
      Text(track.surahName, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 17.sp, fontWeight = FontWeight.Bold))
      Text(track.reciterName, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
    }
    Spacer(GlanceModifier.width(8.dp))
    PrimaryButton(playing, label, action, sizeDp = 40)
  }
  // @ai-end
}
