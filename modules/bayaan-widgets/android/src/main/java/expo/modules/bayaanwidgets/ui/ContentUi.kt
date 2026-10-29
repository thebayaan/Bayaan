// main/java/expo/modules/bayaanwidgets/ui/ContentUi.kt
package expo.modules.bayaanwidgets.ui

import android.content.Context
import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.size
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.BedtimeConfig
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.StaticSurah
import expo.modules.bayaanwidgets.R
import androidx.glance.ColorFilter
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.unit.ColorProvider
import java.util.Date
import org.json.JSONObject

/** The rounded near-black root every Phase 3 widget draws on. */
fun contentRoot(): GlanceModifier = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)

/** Shelf title row: optional leading button, title and detail. */ // @ai
@Composable
fun ShelfHeader(title: String, detail: String?, compact: Boolean = false, leading: (@Composable () -> Unit)? = null) { // @ai
  Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
    if (leading != null) {
      leading()
      Spacer(GlanceModifier.width(8.dp))
    }
    // @ai-start
    if (compact) {
      // One line, so a 110 dp tall shelf keeps room for its tiles.
      Row(GlanceModifier.defaultWeight(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
        if (detail != null) {
          Text("  ·  $detail", maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 11.sp))
        }
      }
    } else {
      Column(GlanceModifier.defaultWeight()) {
        Text(title, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
        if (detail != null) Text(detail, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 11.sp))
      }
    }
    // @ai-end
  }
}

/**
 * A surah card that runs an action when tapped, with an optional caption.
 * While its track plays, the tile dims under a pause glyph and a tap pauses.
 */ // @ai
@Composable
fun SurahTile(context: Context, surahId: Int, sizeDp: Int, action: Action, caption: String? = null, playing: Boolean = false) { // @ai
  val surah = StaticData.surah(context, surahId) // @ai
  Column(GlanceModifier.clickable(playOrPause(context, playing, action)), horizontalAlignment = Alignment.CenterHorizontally) { // @ai
    // @ai-start
    Box(GlanceModifier.size(sizeDp.dp)) {
      SurahCard(context, surah, sizeDp)
      if (playing) PlayingTileOverlay(sizeDp)
    }
    // A cached card prints the surah name, so a caption that repeats it is dropped.
    if (caption != null && !(caption == surah?.name && surahCardShowsName(context, surah))) {
      Spacer(GlanceModifier.height(3.dp))
    // @ai-end
      Text(caption, maxLines = 1, modifier = GlanceModifier.width(sizeDp.dp),
        style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 10.sp, textAlign = TextAlign.Center))
    }
  }
}

// @ai-start
/** A reciter widget's surah row; the playing one turns accent with a pause mark after its name. */
@Composable
fun ReciterSurahRow(context: Context, surah: StaticSurah, playing: Boolean, action: Action) {
  val color = if (playing) ColorProvider(WidgetPalette.ACCENT) else WidgetColors.WHITE
  Row(GlanceModifier.fillMaxWidth().padding(top = 6.dp).clickable(action), verticalAlignment = Alignment.CenterVertically) {
    SurahCard(context, surah, 24)
    Spacer(GlanceModifier.width(8.dp))
    Text(surah.name, maxLines = 1, style = TextStyle(color = color, fontSize = 13.sp, fontWeight = FontWeight.Bold))
    if (playing) {
      Spacer(GlanceModifier.width(5.dp))
      Image(ImageProvider(R.drawable.widget_pause), contentDescription = "Pause", colorFilter = ColorFilter.tint(color),
        modifier = GlanceModifier.size(10.dp))
    }
  }
}
// @ai-end

/** Centered message for empty and unavailable states. */
@Composable
fun ContentMessage(modifier: GlanceModifier, title: String, detail: String?) {
  Column(modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically) {
    Logo(18)
    Spacer(GlanceModifier.height(6.dp))
    Text(title, style = TextStyle(color = WidgetColors.WHITE, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center))
    if (detail != null) Text(detail, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, textAlign = TextAlign.Center))
  }
}

/** Local clock time in the user's 12/24 hour setting, for "Sleep at 23:40". */
fun clockTime(context: Context, epochMs: Long): String = DateFormat.getTimeFormat(context).format(Date(epochMs))

fun playPlaylistCommand(playlistId: String, itemId: String?): JSONObject =
  JSONObject().put("type", "playPlaylist").put("playlistId", playlistId).put("itemId", itemId ?: JSONObject.NULL)

fun startBedtimeCommand(c: BedtimeConfig): JSONObject =
  JSONObject().put("type", "startBedtime").put("surahId", c.surahId)
    .put("reciterId", c.reciterId ?: JSONObject.NULL)
    .put("sleepMinutes", c.minutes)
    .put("ambient", c.ambient ?: JSONObject.NULL)

// @ai-start
fun playAdhkarCommand(superId: String, dhikrId: String?): JSONObject =
  JSONObject().put("type", "playAdhkar").put("superId", superId).put("dhikrId", dhikrId ?: JSONObject.NULL)

fun setAdhkarPlaybackCommand(playing: Boolean): JSONObject =
  JSONObject().put("type", "setAdhkarPlayback").put("playing", playing)

/** Whether the adhkar player is playing this list, from the snapshot. */
fun adhkarPlaying(snapshot: expo.modules.bayaanwidgets.WidgetSnapshot?, superId: String): Boolean =
  snapshot?.adhkar?.let { it.superId == superId && it.isPlaying } == true

/** Plays the list from `dhikrId`, or pauses while the list is playing. */
fun adhkarListenAction(context: Context, playing: Boolean, superId: String, dhikrId: String?): Action =
  if (playing) commandAction(context, setAdhkarPlaybackCommand(false), "adhkar/pause")
  else commandAction(context, playAdhkarCommand(superId, dhikrId), "adhkar/play/$superId/${dhikrId ?: "start"}")
// @ai-end
