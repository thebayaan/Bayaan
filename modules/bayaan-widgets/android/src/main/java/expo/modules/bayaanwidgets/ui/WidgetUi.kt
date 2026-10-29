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
import androidx.glance.ColorFilter
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
import expo.modules.bayaanwidgets.PlaybackState
import expo.modules.bayaanwidgets.WidgetSnapshot
import expo.modules.bayaanwidgets.WidgetTrack
import org.json.JSONObject
import java.io.File
import kotlin.math.roundToInt

/** The Continue Listening look, shared by the Phase 1b widgets. */
object WidgetColors {
  val BACKGROUND = ColorProvider(WidgetPalette.INK) // @ai
  val WHITE = ColorProvider(Color.White)
  val SECONDARY = ColorProvider(Color(0xCCFFFFFF)) // @ai
  val TERTIARY = ColorProvider(Color(0x99FFFFFF))
  val TILE = ColorProvider(Color(0x26FFFFFF))
  val BUTTON = ColorProvider(Color(0x2EFFFFFF))
}

// @ai-start
/** Redesign tokens, matching targets/widgets/Support/WidgetChrome.swift on iOS. */
object WidgetPalette {
  val INK = Color(0xFF0B1E26)
  val NIGHT = Color(0xFF071A22)
  val PAPER = Color(0xFFF4F3EC)
  val PAPER_INK = Color(0xFF06151C)
  val PAPER_SECONDARY = Color(0xFF3A4A52)
  val PAPER_LABEL = Color(0xFF6B5B3A)
  val PAPER_RULE = Color(0xFFDCD8C8)
  val GOLD = Color(0xFFD6BE8C)
  val ACCENT = Color(0xFF1F9D6B)
  val BEDTIME = Color(0xFF10142B)
  val MOON = Color(0xFFE8D9A8)
  val RECITER = Color(0xFF1E1838)
  val RECITER_TILE = Color(0xFF5645A1)
}

/** Each surah gets one of eight tints, so Listen widgets change color with what is playing. */
object SurahTint {
  private val BASE = longArrayOf(0xFF1D6461, 0xFF5645A1, 0xFF273A6B, 0xFF9A4A2B, 0xFF1F6B47, 0xFF6B2F5A, 0xFF3B5566, 0xFF5F6332)
  private val DEEP = longArrayOf(0xFF0F2C2C, 0xFF1E1838, 0xFF101A30, 0xFF2E1710, 0xFF0D2A1D, 0xFF2A1224, 0xFF14212A, 0xFF24260F)

  fun base(surahId: Int): Color = if (surahId <= 0) Color(0x26FFFFFF) else Color(BASE[(surahId - 1) % 8])
  fun deep(surahId: Int): Color = if (surahId <= 0) WidgetPalette.INK else Color(DEEP[(surahId - 1) % 8])
}

/** Read widgets: paper by day, night ink with gold by night. */
object ReadingColors {
  val BACKGROUND = androidx.glance.color.ColorProvider(day = WidgetPalette.PAPER, night = WidgetPalette.NIGHT)
  val PRIMARY = androidx.glance.color.ColorProvider(day = WidgetPalette.PAPER_INK, night = Color(0xFFF4F3EC))
  val SECONDARY = androidx.glance.color.ColorProvider(day = WidgetPalette.PAPER_SECONDARY, night = Color(0xBFF4F3EC))
  val LABEL = androidx.glance.color.ColorProvider(day = WidgetPalette.PAPER_LABEL, night = WidgetPalette.GOLD)
  val RULE = androidx.glance.color.ColorProvider(day = WidgetPalette.PAPER_RULE, night = Color(0x33D6BE8C))
  val BUTTON = androidx.glance.color.ColorProvider(day = WidgetPalette.PAPER_INK, night = WidgetPalette.GOLD)
  val BUTTON_GLYPH = androidx.glance.color.ColorProvider(day = WidgetPalette.PAPER, night = WidgetPalette.NIGHT)
}
// @ai-end

object WidgetSizes {
  val SMALL = DpSize(110.dp, 110.dp)
  /** A 2x2 cell is often ~180 dp tall; without this bucket it renders at 110 dp and clips tall text. */
  val SMALL_TALL = DpSize(110.dp, 180.dp)
  val MEDIUM = DpSize(250.dp, 110.dp)
  /** A 4x2 cell is often ~180 dp tall; the ayah needs more than the 44 dp slot of the 110 dp bucket. */
  val MEDIUM_TALL = DpSize(250.dp, 180.dp)
  val LARGE = DpSize(250.dp, 250.dp)

  /** A 110 dp tall cell (dense launchers, the smallest bucket) needs the compact layout. */ // @ai
  fun isShort(size: DpSize): Boolean = size.height < 150.dp // @ai
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

// @ai-start
/** Whether the system is in dark mode, for colors baked into bitmaps (Arabic text). */
fun isNightMode(context: Context): Boolean =
  (context.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
    android.content.res.Configuration.UI_MODE_NIGHT_YES

/** The track playing right now, from the snapshot and any newer tap override. */
fun playingTrack(context: Context, snapshot: WidgetSnapshot?): WidgetTrack? = PlaybackState.playingTrack(
  snapshot, PlaybackState.decodeOverride(WidgetStorage.readPlaybackOverrideJson(context)), System.currentTimeMillis(),
)

fun setPlaybackCommand(playing: Boolean): JSONObject = JSONObject().put("type", "setPlayback").put("playing", playing)

/** Pauses the main player while `playing`, else runs `play`. */
fun playOrPause(context: Context, playing: Boolean, play: Action): Action =
  if (playing) commandAction(context, setPlaybackCommand(false), "pause") else play

/** Small uppercase label above a title, e.g. "NOW PLAYING". */
@Composable
fun Eyebrow(text: String, color: ColorProvider = WidgetColors.SECONDARY) {
  Text(text.uppercase(), maxLines = 1, style = TextStyle(color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold))
}

/**
 * The filled play/pause circle. With an action it is its own button; without
 * one it is only the glyph, for a tile that is the button.
 */
@Composable
fun PrimaryButton(
  playing: Boolean, description: String, action: Action?, sizeDp: Int = 40,
  fill: ColorProvider = ColorProvider(WidgetPalette.ACCENT), glyph: ColorProvider = WidgetColors.WHITE,
) {
  var modifier = GlanceModifier.size(sizeDp.dp).background(fill).cornerRadius((sizeDp / 2).dp)
  if (action != null) modifier = modifier.clickable(action)
  Box(modifier, contentAlignment = Alignment.Center) {
    Image(
      ImageProvider(if (playing) R.drawable.widget_pause else R.drawable.widget_play),
      contentDescription = if (playing) "Pause" else description,
      colorFilter = ColorFilter.tint(glyph),
      modifier = GlanceModifier.size((sizeDp * 9 / 20).dp),
    )
  }
}

/** Dims a playing tile and centers a pause glyph on it. */
@Composable
fun PlayingTileOverlay(sizeDp: Int) {
  Box(
    GlanceModifier.size(sizeDp.dp).background(ColorProvider(Color(0x99000000))).cornerRadius((sizeDp / 5).dp),
    contentAlignment = Alignment.Center,
  ) {
    PrimaryButton(playing = true, description = "Pause", action = null, sizeDp = maxOf(26, sizeDp / 2))
  }
}
// @ai-end

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

/** The surah card when cached, else a generated tile in the surah's tint. */ // @ai
@Composable
fun SurahCard(context: Context, surah: StaticSurah?, sizeDp: Int) {
  val bmp = surah?.let { loadArtwork(context, it.artworkFile, sizeDp) }
  val corner = (sizeDp / 5).dp // @ai
  // @ai-start
  Box(GlanceModifier.size(sizeDp.dp)) {
    if (surah != null && bmp != null) {
      Image(
        ImageProvider(bmp), contentDescription = surah.name,
        modifier = GlanceModifier.size(sizeDp.dp).cornerRadius(corner), contentScale = ContentScale.Crop,
      )
    } else {
      GeneratedSurahTile(context, surah, sizeDp)
    }
    // A hairline edge keeps dark cards distinct on dark backgrounds.
    Image(
      ImageProvider(R.drawable.widget_keyline), contentDescription = null,
      modifier = GlanceModifier.size(sizeDp.dp).cornerRadius(corner), contentScale = ContentScale.FillBounds,
    )
  }
  // @ai-end
}

// @ai-start
/** True when the cached card, which has the surah name printed on it, will show. */
fun surahCardShowsName(context: Context, surah: StaticSurah?): Boolean =
  surah != null && File(WidgetStorage.artworkDir(context), surah.artworkFile).exists()

/** Stand-in artwork: the surah's tint and its name glyph, so a widget never shows an empty box. */
@Composable
fun GeneratedSurahTile(context: Context, surah: StaticSurah?, sizeDp: Int) {
  Box(
    GlanceModifier.size(sizeDp.dp).background(ColorProvider(SurahTint.base(surah?.id ?: 0))).cornerRadius((sizeDp / 5).dp),
    contentAlignment = Alignment.Center,
  ) {
    if (surah == null) return@Box
    if (surah.glyph.isNotEmpty()) {
      SurahGlyph(context, surah.glyph, (sizeDp * 0.86f), (sizeDp * 0.5f))
    } else {
      Text(surah.id.toString(), style = TextStyle(color = WidgetColors.WHITE, fontSize = (sizeDp / 3).sp, fontWeight = FontWeight.Bold))
    }
  }
}

/** The surah name glyph from surah_names.ttf, drawn to a bitmap like ArabicText. */
@Composable
fun SurahGlyph(context: Context, glyph: String, widthDp: Float, heightDp: Float, color: Int = android.graphics.Color.WHITE) {
  val metrics = context.resources.displayMetrics
  val widthPx = (widthDp * metrics.density).roundToInt()
  val heightPx = (heightDp * metrics.density).roundToInt()
  val bmp = remember(glyph, widthPx, heightPx, color) {
    ArabicBitmap.render(
      context, glyph, ArabicBitmap.SURAH_NAMES_FONT, widthPx, heightPx,
      heightPx * 0.9f, heightPx * 0.4f, color, center = true, maxLines = 1,
    )
  } ?: return
  Image(
    ImageProvider(bmp), contentDescription = null,
    modifier = GlanceModifier.width(widthDp.dp).height((bmp.height / metrics.density).dp),
    contentScale = ContentScale.Fit,
  )
}
// @ai-end

/** The reciter photo when cached, else initials on a dark tile. */
@Composable
fun ReciterPhoto(context: Context, file: String?, name: String, widthDp: Int, heightDp: Int, cornerDp: Int) {
  val bmp = loadArtwork(context, file, maxOf(widthDp, heightDp))
  val modifier = GlanceModifier.width(widthDp.dp).height(heightDp.dp).cornerRadius(cornerDp.dp)
  if (bmp != null) {
    Image(ImageProvider(bmp), contentDescription = name, modifier = modifier, contentScale = ContentScale.Crop)
    return
  }
  Box(modifier.background(ColorProvider(WidgetPalette.RECITER_TILE)), contentAlignment = Alignment.Center) { // @ai
    Text(WidgetText.initials(name), style = TextStyle(color = WidgetColors.WHITE, fontSize = 20.sp, fontWeight = FontWeight.Bold))
  }
}

/** Arabic text drawn to a bitmap (Glance has no custom fonts). */
@Composable
fun ArabicText(
  context: Context, text: String, font: String, widthDp: Float, maxHeightDp: Float,
  maxSp: Float, minSp: Float, maxLines: Int, center: Boolean, wholeLines: Boolean = false,
  color: Int = android.graphics.Color.WHITE, // @ai
) {
  val metrics = context.resources.displayMetrics
  val widthPx = (widthDp * metrics.density).roundToInt()
  val heightPx = (maxHeightDp * metrics.density).roundToInt()
  val bmp = remember(text, font, widthPx, heightPx, maxSp, minSp, maxLines, center, wholeLines, color) { // @ai
    ArabicBitmap.render(
      context, text, font, widthPx, heightPx,
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, maxSp, metrics),
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, minSp, metrics),
      color, center, maxLines, wholeLines, // @ai
    )
  } ?: return
  Image(
    ImageProvider(bmp), contentDescription = text,
    modifier = GlanceModifier.width(widthDp.dp).height((bmp.height / metrics.density).dp),
    contentScale = ContentScale.Fit,
  )
}
