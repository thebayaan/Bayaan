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
import java.util.Date
import org.json.JSONObject

/** The rounded near-black root every Phase 3 widget draws on. */
fun contentRoot(): GlanceModifier = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)

/** Shelf title row: optional leading button, title and detail, Bayaan mark. */
@Composable
fun ShelfHeader(title: String, detail: String?, leading: (@Composable () -> Unit)? = null) {
  Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
    if (leading != null) {
      leading()
      Spacer(GlanceModifier.width(8.dp))
    }
    Column(GlanceModifier.defaultWeight()) {
      Text(title, maxLines = 1, style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
      if (detail != null) Text(detail, maxLines = 1, style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp))
    }
    Logo(14)
  }
}

/** A surah card that runs an action when tapped, with an optional caption. */
@Composable
fun SurahTile(context: Context, surahId: Int, sizeDp: Int, action: Action, caption: String? = null) {
  Column(GlanceModifier.clickable(action), horizontalAlignment = Alignment.CenterHorizontally) {
    SurahCard(context, StaticData.surah(context, surahId), sizeDp)
    if (caption != null) {
      Text(caption, maxLines = 1, modifier = GlanceModifier.width(sizeDp.dp),
        style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 10.sp, textAlign = TextAlign.Center))
    }
  }
}

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
