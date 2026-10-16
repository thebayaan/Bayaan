package expo.modules.bayaanwidgets.ui

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.TypedValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.height
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import expo.modules.bayaanwidgets.AppLinks
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.StaticSurah
import expo.modules.bayaanwidgets.WidgetCommandActivity
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.WidgetText
import org.json.JSONObject
import java.io.File
import kotlin.math.roundToInt

/** The Continue Listening look, shared by the Phase 1b widgets. */
object WidgetColors {
  val BACKGROUND = ColorProvider(Color(0xFF1C1C1E))
  val WHITE = ColorProvider(Color.White)
  val SECONDARY = ColorProvider(Color(0xBFFFFFFF))
  val TERTIARY = ColorProvider(Color(0x99FFFFFF))
  val TILE = ColorProvider(Color(0x26FFFFFF))
  val BUTTON = ColorProvider(Color(0x2EFFFFFF))
}

object WidgetSizes {
  val SMALL = DpSize(110.dp, 110.dp)
  /** A 2x2 cell is often ~180 dp tall; without this bucket it renders at 110 dp and clips tall text. */
  val SMALL_TALL = DpSize(110.dp, 180.dp)
  val MEDIUM = DpSize(250.dp, 110.dp)
  /** A 4x2 cell is often ~180 dp tall; the ayah needs more than the 44 dp slot of the 110 dp bucket. */
  val MEDIUM_TALL = DpSize(250.dp, 180.dp)
  val LARGE = DpSize(250.dp, 250.dp)
}

fun dpToPx(context: Context, dp: Int): Int =
  maxOf(1, (dp * context.resources.displayMetrics.density).roundToInt())

/** Decodes at roughly the rendered pixel size to keep RemoteViews small. */
private fun decodeArtwork(file: File, px: Int): Bitmap? {
  val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  BitmapFactory.decodeFile(file.path, bounds)
  if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
  var sample = 1
  while (minOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= px) sample *= 2
  val bmp = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
  if (bmp.width <= px && bmp.height <= px) return bmp
  val scale = px.toFloat() / maxOf(bmp.width, bmp.height)
  return Bitmap.createScaledBitmap(bmp, maxOf(1, (bmp.width * scale).roundToInt()), maxOf(1, (bmp.height * scale).roundToInt()), true)
}

/** A cached artwork file at about sizeDp, or null when it is not cached yet. */
fun loadArtwork(context: Context, file: String?, sizeDp: Int): Bitmap? =
  file?.let { File(WidgetStorage.artworkDir(context), it) }?.takeIf { it.exists() }
    ?.let { decodeArtwork(it, dpToPx(context, sizeDp)) }

fun deepLink(context: Context, url: String): Action =
  actionStartActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(context.packageName))

/** Opens path (no leading slash) under the app's URL scheme, e.g. "player". */
fun appLink(context: Context, path: String): Action = deepLink(context, AppLinks.url(context, path))

/** Routes a command through WidgetCommandActivity; key keeps PendingIntents distinct. */
fun commandAction(context: Context, command: JSONObject, key: String): Action =
  actionStartActivity(WidgetCommandActivity.intent(context, command).setData(Uri.parse("bayaan-widget://$key")))

fun playTrackCommand(surahId: Int, reciterId: String?, rewayatId: String?, ayah: Int?): JSONObject =
  JSONObject().put("type", "playTrack").put("surahId", surahId)
    .put("reciterId", reciterId ?: JSONObject.NULL)
    .put("rewayatId", rewayatId ?: JSONObject.NULL)
    .put("ayah", ayah ?: JSONObject.NULL)

fun playReciterCommand(reciterId: String): JSONObject =
  JSONObject().put("type", "playReciter").put("reciterId", reciterId)

@Composable
fun Logo(height: Int) {
  Image(
    ImageProvider(R.drawable.bayaan_mark), contentDescription = null,
    modifier = GlanceModifier.width((height * 6 / 5).dp).height(height.dp),
  )
}

/** Round 30 dp button matching Continue Listening's play button. */
@Composable
fun RoundButton(icon: Int, description: String, action: Action) {
  Box(
    GlanceModifier.size(30.dp).background(WidgetColors.BUTTON).cornerRadius(15.dp).clickable(action),
    contentAlignment = Alignment.Center,
  ) {
    Image(ImageProvider(icon), contentDescription = description, modifier = GlanceModifier.size(18.dp))
  }
}

/** Surah ids whose cached card is missing; call from provideGlance, outside composition. */
fun missingSurahArtwork(context: Context, surahIds: List<Int>): List<Int> =
  surahIds.distinct().filter { id ->
    val file = StaticData.surah(context, id)?.artworkFile
    file == null || !File(WidgetStorage.artworkDir(context), file).exists()
  }

/** Reciters (id to artwork file) whose cached photo is missing; call from provideGlance. */
fun missingReciterArtwork(context: Context, reciters: List<Pair<String, String?>>): List<String> =
  reciters.distinctBy { it.first }.filter { (_, file) ->
    file == null || !File(WidgetStorage.artworkDir(context), file).exists()
  }.map { it.first }

/** Records the artwork a widget is about to need and lacks. Not for use inside composables. */
fun recordMissingArtwork(context: Context, surahIds: List<Int>, reciters: List<Pair<String, String?>>) =
  WidgetStorage.recordArtworkRequests(context, missingSurahArtwork(context, surahIds), missingReciterArtwork(context, reciters))

/** The surah card when cached, else a dark tile with the number and name. */
@Composable
fun SurahCard(context: Context, surah: StaticSurah?, sizeDp: Int) {
  val bmp = surah?.let { loadArtwork(context, it.artworkFile, sizeDp) }
  val corner = (sizeDp / 6).dp
  if (surah != null && bmp != null) {
    Image(
      ImageProvider(bmp), contentDescription = surah.name,
      modifier = GlanceModifier.size(sizeDp.dp).cornerRadius(corner), contentScale = ContentScale.Crop,
    )
    return
  }
  Column(
    GlanceModifier.size(sizeDp.dp).background(WidgetColors.TILE).cornerRadius(corner),
    horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(surah?.id?.toString() ?: "", style = TextStyle(color = WidgetColors.WHITE, fontSize = (sizeDp / 3).sp, fontWeight = FontWeight.Bold))
    if (surah != null && sizeDp >= 44) {
      Text(surah.name, maxLines = 1, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 9.sp, textAlign = TextAlign.Center))
    }
  }
}

/** The reciter photo when cached, else initials on a dark tile. */
@Composable
fun ReciterPhoto(context: Context, file: String?, name: String, widthDp: Int, heightDp: Int, cornerDp: Int) {
  val bmp = loadArtwork(context, file, maxOf(widthDp, heightDp))
  val modifier = GlanceModifier.width(widthDp.dp).height(heightDp.dp).cornerRadius(cornerDp.dp)
  if (bmp != null) {
    Image(ImageProvider(bmp), contentDescription = name, modifier = modifier, contentScale = ContentScale.Crop)
    return
  }
  Box(modifier.background(WidgetColors.TILE), contentAlignment = Alignment.Center) {
    Text(WidgetText.initials(name), style = TextStyle(color = WidgetColors.WHITE, fontSize = 20.sp, fontWeight = FontWeight.Bold))
  }
}

/** Arabic text drawn to a bitmap (Glance has no custom fonts). */
@Composable
fun ArabicText(
  context: Context, text: String, font: String, widthDp: Float, maxHeightDp: Float,
  maxSp: Float, minSp: Float, maxLines: Int, center: Boolean, wholeLines: Boolean = false,
) {
  val metrics = context.resources.displayMetrics
  val widthPx = (widthDp * metrics.density).roundToInt()
  val heightPx = (maxHeightDp * metrics.density).roundToInt()
  val bmp = remember(text, font, widthPx, heightPx, maxSp, minSp, maxLines, center, wholeLines) {
    ArabicBitmap.render(
      context, text, font, widthPx, heightPx,
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, maxSp, metrics),
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, minSp, metrics),
      android.graphics.Color.WHITE, center, maxLines, wholeLines,
    )
  } ?: return
  Image(
    ImageProvider(bmp), contentDescription = text,
    modifier = GlanceModifier.width(widthDp.dp).height((bmp.height / metrics.density).dp),
    contentScale = ContentScale.Fit,
  )
}
