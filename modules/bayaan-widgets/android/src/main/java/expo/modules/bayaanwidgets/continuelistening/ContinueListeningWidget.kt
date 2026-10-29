package expo.modules.bayaanwidgets.continuelistening

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.remember
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.currentState
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.background
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
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import expo.modules.bayaanwidgets.AppLinks
import expo.modules.bayaanwidgets.OverrideExpiryWorker
import expo.modules.bayaanwidgets.WidgetCommandActivity
import expo.modules.bayaanwidgets.PlaybackOverride
import expo.modules.bayaanwidgets.PlaybackState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.WidgetSnapshot
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.WidgetTrack
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetText
import expo.modules.bayaanwidgets.ui.Eyebrow
import expo.modules.bayaanwidgets.ui.GeneratedSurahTile
import expo.modules.bayaanwidgets.ui.PrimaryButton
import expo.modules.bayaanwidgets.ui.SurahGlyph
import expo.modules.bayaanwidgets.ui.SurahTint
import expo.modules.bayaanwidgets.ui.WidgetPalette
import org.json.JSONObject
import java.io.File
import kotlin.math.roundToInt

// Decoded artwork for one composition, keyed by file and pixel size, so rows
// that share a reciter reuse one bitmap in the RemoteViews payload.
private val LocalArtCache = staticCompositionLocalOf<MutableMap<String, Bitmap?>> { HashMap() }

/** Decodes at (roughly) the rendered pixel size to keep RemoteViews small. */
private fun decodeArt(file: File, px: Int): Bitmap? {
  val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  BitmapFactory.decodeFile(file.path, bounds)
  if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
  var sample = 1
  while (minOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= px) sample *= 2
  val bmp = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    ?: return null
  if (bmp.width <= px && bmp.height <= px) return bmp
  val scale = px.toFloat() / maxOf(bmp.width, bmp.height)
  return Bitmap.createScaledBitmap(
    bmp, maxOf(1, (bmp.width * scale).roundToInt()), maxOf(1, (bmp.height * scale).roundToInt()), true,
  )
}

// @ai-start
/**
 * Draws the top `fraction` of the art across the full width at its own aspect,
 * at most `bandPx` tall (shrunk to fit if needed), filling the rest with `fill`. A surah card prints its name in its
 * lower part, so keeping only the calligraphy lets the widget draw its own
 * title and controls under it without zooming into a sliver of the card.
 */
private fun cropTopFill(src: Bitmap, widthPx: Int, heightPx: Int, fraction: Float, fill: Int, bandPx: Int = heightPx): Bitmap {
  val out = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
  val canvas = android.graphics.Canvas(out)
  // A card is shrunk into the band on its own ground, so its edges disappear.
  val ground = if (fraction < 1f) src.getPixel(minOf(2, src.width - 1), minOf(2, src.height - 1)) else fill
  canvas.drawColor(ground)
  val srcH = src.height * fraction
  val scale = widthPx.toFloat() / src.width
  val drawnH = srcH * scale
  val band = minOf(heightPx, bandPx)
  val srcRect = android.graphics.Rect(0, 0, src.width, srcH.roundToInt())
  // Taller than the band: shrink the art to fit it, centred, so nothing is sliced.
  val dst = if (drawnH <= band) {
    android.graphics.Rect(0, 0, widthPx, drawnH.roundToInt())
  } else {
    val w = (src.width * band / srcH).roundToInt()
    android.graphics.Rect((widthPx - w) / 2, 0, (widthPx + w) / 2, band)
  }
  canvas.drawBitmap(src, srcRect, dst, android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG))
  if (dst.width() < widthPx) featherEdges(canvas, dst, ground)
  return out
}

/** Fades the left, right and bottom of `r` into `ground`, so shrunk art has no seam. */
private fun featherEdges(canvas: android.graphics.Canvas, r: android.graphics.Rect, ground: Int) {
  val f = r.height() * 0.22f
  val clear = ground and 0x00FFFFFF
  fun band(x0: Float, y0: Float, x1: Float, y1: Float, rect: android.graphics.RectF) {
    val paint = android.graphics.Paint().apply {
      shader = android.graphics.LinearGradient(x0, y0, x1, y1, ground, clear, android.graphics.Shader.TileMode.CLAMP)
    }
    canvas.drawRect(rect, paint)
  }
  val l = r.left.toFloat(); val t = r.top.toFloat(); val rt = r.right.toFloat(); val b = r.bottom.toFloat()
  band(l, 0f, l + f, 0f, android.graphics.RectF(l, t, l + f, b))
  band(rt, 0f, rt - f, 0f, android.graphics.RectF(rt - f, t, rt, b))
  band(0f, b, 0f, b - f, android.graphics.RectF(l, b - f, rt, b))
}
// @ai-end

class ContinueListeningWidget : GlanceAppWidget() {
  companion object {
    private val SMALL = DpSize(110.dp, 110.dp)
    private val MEDIUM = DpSize(250.dp, 110.dp)
    private val LARGE = DpSize(250.dp, 250.dp)
    /** Below this height a medium widget is the dense 110 dp cell. */ // @ai
    const val TALL_DP = 150 // @ai
    /** The share of a surah card above its printed name. */ // @ai
    const val CARD_ART_FRACTION = 0.56f // @ai
    /** Padding, title and the reciter/button row under a small card's art. */ // @ai
    const val SMALL_CHROME_DP = 70 // @ai

    private val WHITE = ColorProvider(Color.White)
    private val SECONDARY = ColorProvider(Color(0xCCFFFFFF)) // @ai

    val SNAPSHOT_KEY = stringPreferencesKey("snapshot")
    val OVERRIDE_KEY = stringPreferencesKey("playbackOverride")
    // Changes on every push so a live session always recomposes.
    private val PUSHED_AT_KEY = longPreferencesKey("pushedAt")

    /**
     * Copies the stored snapshot and playback override into each widget's Glance
     * state and recomposes it. A live Glance session only recomposes from its
     * state; it does not re-run provideGlance on update.
     */
    suspend fun pushState(context: Context) {
      val json = WidgetStorage.readSnapshotJson(context)
      val override = WidgetStorage.readPlaybackOverrideJson(context)
      val ids = GlanceAppWidgetManager(context).getGlanceIds(ContinueListeningWidget::class.java)
      for (id in ids) {
        updateAppWidgetState(context, id) { prefs ->
          if (json != null) prefs[SNAPSHOT_KEY] = json else prefs.remove(SNAPSHOT_KEY)
          if (override != null) prefs[OVERRIDE_KEY] = override else prefs.remove(OVERRIDE_KEY)
          prefs[PUSHED_AT_KEY] = System.currentTimeMillis()
        }
        ContinueListeningWidget().update(context, id)
      }
      syncTrackEndRefresh(context, json, override)
    }

    /** Schedules a re-render at the computed track end while playing, else cancels it. */
    fun syncTrackEndRefresh(context: Context, json: String?, overrideJson: String?) {
      val snapshot = json?.let { SnapshotModels.decode(it) }
      val np = snapshot?.nowPlaying
      val playback = np?.let {
        PlaybackState.effective(it, snapshot.generatedAt, PlaybackState.decodeOverride(overrideJson), System.currentTimeMillis())
      }
      if (playback?.isPlaying == true) {
        OverrideExpiryWorker.scheduleTrackEnd(context, (playback.remainingWallSec * 1000).toLong() + 1_000)
      } else {
        OverrideExpiryWorker.cancelTrackEnd(context)
      }
    }
  }

  override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM, LARGE))

  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    // Fallbacks for the first composition, before any state has been pushed.
    val initialJson = WidgetStorage.readSnapshotJson(context)
    val initialOverride = WidgetStorage.readPlaybackOverrideJson(context)
    provideContent {
      val prefs = currentState<Preferences>()
      val json = prefs[SNAPSHOT_KEY] ?: initialJson
      val overrideJson = prefs[OVERRIDE_KEY] ?: initialOverride
      val snapshot = remember(json) { json?.let { SnapshotModels.decode(it) } }
      val override = remember(overrideJson) { PlaybackState.decodeOverride(overrideJson) }
      val artCache = remember(json) { HashMap<String, Bitmap?>() }
      CompositionLocalProvider(LocalArtCache provides artCache) {
        Content(context, snapshot, override)
      }
    }
  }

  // @ai-start
  @Composable
  private fun Content(context: Context, s: WidgetSnapshot?, override: PlaybackOverride?) {
    val track = s?.nowPlaying?.track ?: s?.recent?.firstOrNull() ?: s?.upNext?.firstOrNull()
    val openPlayer = actionStartActivity(
      Intent(Intent.ACTION_VIEW, Uri.parse(AppLinks.url(context, "player"))).setPackage(context.packageName),
    )
    val tint = ColorProvider(SurahTint.deep(track?.surahId ?: 0))
    val root = GlanceModifier.fillMaxSize().background(tint).cornerRadius(20.dp).clickable(openPlayer)

    if (s == null || track == null) {
      Column(root.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically) {
        Logo(24)
        Spacer(GlanceModifier.height(8.dp))
        Text("Start listening", style = TextStyle(color = WHITE, fontWeight = FontWeight.Medium))
      }
      return
    }
    val size = LocalSize.current
    val np = s.nowPlaying
    val playback = np?.let { PlaybackState.effective(it, s.generatedAt, override, System.currentTimeMillis()) }
    val hero = Hero(
      track = track,
      hasNowPlaying = np != null,
      isPlaying = playback?.isPlaying ?: false,
      progress = if (np != null && playback != null && np.durationSec > 0) {
        val rate = if (np.rate > 0 && np.rate.isFinite()) np.rate else 1.0
        (1 - playback.remainingWallSec * rate / np.durationSec).toFloat().coerceIn(0f, 1f)
      } else null,
      minutesLeft = playback?.let { (it.remainingWallSec / 60).roundToInt() },
    )
    // Drop the side list's first item when it is already the hero.
    val sideSource =
      if (s.upNext.isEmpty()) s.recent.drop(if (s.nowPlaying == null) 1 else 0)
      else s.upNext.drop(if (s.nowPlaying == null && s.recent.isEmpty()) 1 else 0)
    val sideTitle = if (s.upNext.isEmpty()) "Recent" else "Up next"
    when {
      size.width >= MEDIUM.width && size.height >= LARGE.height ->
        Large(context, hero, sideSource.take(4), sideTitle, root.padding(16.dp))
      size.width >= MEDIUM.width -> Medium(context, hero, sideSource.firstOrNull(), sideTitle,
        root.padding(if (size.height < TALL_DP.dp) 10.dp else 12.dp))
      else -> Small(context, hero, root, size.width.value.toInt(), size.height.value.toInt())
    }
  }

  /** Everything the hero needs, resolved once per composition. */
  private class Hero(
    val track: WidgetTrack,
    val hasNowPlaying: Boolean,
    val isPlaying: Boolean,
    val progress: Float?,
    val minutesLeft: Int?,
  )

  private fun eyebrow(hero: Hero): String = when {
    hero.isPlaying -> "Now playing"
    hero.hasNowPlaying -> "Paused"
    else -> "Continue listening"
  }

  private fun cachedArt(context: Context, cache: MutableMap<String, Bitmap?>, file: String?, px: Int): Bitmap? =
    file?.let { name ->
      cache.getOrPut("$name@$px") {
        File(WidgetStorage.artworkDir(context), name).takeIf { it.exists() }?.let { decodeArt(it, px) }
      }
    }

  /** Square art: the cached card or photo, else the generated surah tile. */
  @Composable
  private fun Art(context: Context, track: WidgetTrack, size: Int) {
    val px = maxOf(1, (size * context.resources.displayMetrics.density).roundToInt())
    val bmp = cachedArt(context, LocalArtCache.current, track.artworkFile, px)
    Box(GlanceModifier.size(size.dp)) {
      if (bmp != null) {
        Image(
          ImageProvider(bmp), contentDescription = null,
          modifier = GlanceModifier.size(size.dp).cornerRadius((size / 6).dp),
          contentScale = ContentScale.Crop,
        )
      } else {
        GeneratedSurahTile(context, StaticData.surah(context, track.surahId), size)
      }
      Image(
        ImageProvider(R.drawable.widget_keyline), contentDescription = null,
        modifier = GlanceModifier.size(size.dp).cornerRadius((size / 6).dp), contentScale = ContentScale.FillBounds,
      )
    }
  }

  @Composable
  private fun Logo(height: Int) {
    Image(
      ImageProvider(R.drawable.bayaan_mark), contentDescription = null,
      modifier = GlanceModifier.width((height * 6 / 5).dp).height(height.dp),
    )
  }

  /**
   * Play/pause in the accent circle. With nothing loaded (the hero is a recent
   * item or the surah of the day), it starts that track.
   */
  @Composable
  private fun PlayButton(context: Context, hero: Hero, size: Int) {
    val track = hero.track
    val cmd = when {
      // Absolute target: the opposite of what is rendered.
      hero.hasNowPlaying -> JSONObject().put("type", "setPlayback").put("playing", !hero.isPlaying)
      track.isUserUpload || track.surahId == 0 -> return
      else -> playTrackCommand(track)
    }
    PrimaryButton(
      playing = hero.isPlaying, description = "Play", sizeDp = size,
      action = actionStartActivity(
        WidgetCommandActivity.intent(context, cmd)
          .setData(Uri.parse("bayaan-widget://hero/${cmd.toString().hashCode()}")),
      ),
    )
  }

  /** Thin bar on a faint track. Static: refreshed on each push. */
  @Composable
  private fun Progress(progress: Float?, modifier: GlanceModifier) {
    if (progress == null) return
    LinearProgressIndicator(
      progress = progress, modifier = modifier.height(4.dp),
      color = ColorProvider(WidgetPalette.GOLD), backgroundColor = ColorProvider(Color(0x33FFFFFF)),
    )
  }

  @Composable
  private fun TimeLeft(hero: Hero) {
    val m = hero.minutesLeft ?: return
    if (!hero.hasNowPlaying) return
    Text("${m}m left", maxLines = 1, style = TextStyle(color = SECONDARY, fontSize = 11.sp, fontWeight = FontWeight.Medium))
  }

  /**
   * Full-bleed art with the title, reciter and play button over a fade. A
   * cached card is cropped to its calligraphy, so its printed name never sits
   * under the controls or repeats the title.
   */
  @Composable
  private fun Small(context: Context, hero: Hero, root: GlanceModifier, widthDp: Int, heightDp: Int) {
    val density = context.resources.displayMetrics.density
    val wPx = maxOf(1, (widthDp * density).roundToInt())
    val hPx = maxOf(1, (heightDp * density).roundToInt())
    val track = hero.track
    val surah = StaticData.surah(context, track.surahId)
    val cardNamed = surah != null && track.artworkFile == surah.artworkFile
    val src = cachedArt(context, LocalArtCache.current, track.artworkFile, maxOf(wPx, hPx))
    val art = src?.let { cropTopFill(it, wPx, hPx, if (cardNamed) CARD_ART_FRACTION else 1f, SurahTint.deep(track.surahId).toArgb(),
      // A card's calligraphy ends above the title and controls.
      if (cardNamed) hPx - (SMALL_CHROME_DP * density).roundToInt() else hPx) }
    Box(root) {
      if (art != null) {
        Image(ImageProvider(art), contentDescription = null, modifier = GlanceModifier.fillMaxSize(),
          contentScale = ContentScale.FillBounds)
      } else {
        Box(GlanceModifier.fillMaxSize().background(ColorProvider(SurahTint.base(track.surahId))).padding(12.dp),
          contentAlignment = Alignment.TopEnd) {
          if (surah != null && surah.glyph.isNotEmpty()) SurahGlyph(context, surah.glyph, 70f, 36f)
        }
      }
      Image(ImageProvider(R.drawable.widget_scrim), contentDescription = null,
        modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
      Column(GlanceModifier.fillMaxSize().padding(12.dp), verticalAlignment = Alignment.Bottom) {
        // The title gets the full width; the reciter shares its row with the button.
        Text(track.surahName, maxLines = 1, style = TextStyle(color = WHITE, fontSize = 15.sp, fontWeight = FontWeight.Bold))
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Text(WidgetText.fitName(track.reciterName, maxOf(6, (widthDp - 64) / 7)), maxLines = 1,
            modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Medium))
          Spacer(GlanceModifier.width(4.dp))
          PlayButton(context, hero, 34)
        }
      }
    }
  }

  @Composable
  private fun Medium(context: Context, hero: Hero, next: WidgetTrack?, nextTitle: String, root: GlanceModifier) {
    // A 110 dp tall cell (dense launchers) has no room for the progress bar.
    val short = LocalSize.current.height < TALL_DP.dp
    Row(root, verticalAlignment = Alignment.CenterVertically) {
      Art(context, hero.track, if (short) 80 else 96)
      Spacer(GlanceModifier.width(if (short) 12.dp else 14.dp))
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        // The short cell drops the eyebrow so the button clears the bottom edge.
        if (!short) Eyebrow(eyebrow(hero))
        Text(hero.track.surahName, maxLines = 1, style = TextStyle(color = WHITE, fontSize = 18.sp, fontWeight = FontWeight.Bold))
        Text(hero.track.reciterName, maxLines = 1, style = TextStyle(color = SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Medium))
        Spacer(GlanceModifier.defaultWeight())
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          PlayButton(context, hero, if (short) 32 else 40)
          if (next != null) {
            Spacer(GlanceModifier.width(10.dp))
            Column(GlanceModifier.defaultWeight()) {
              Text(nextTitle, maxLines = 1, style = TextStyle(color = SECONDARY, fontSize = 10.sp, fontWeight = FontWeight.Medium))
              Text(next.surahName, maxLines = 1, style = TextStyle(color = WHITE, fontSize = 12.sp, fontWeight = FontWeight.Bold))
            }
          }
        }
        if (hero.hasNowPlaying && !short) {
          Spacer(GlanceModifier.height(6.dp))
          Progress(hero.progress, GlanceModifier.fillMaxWidth())
        }
      }
    }
  }

  @Composable
  private fun Large(context: Context, hero: Hero, rows: List<WidgetTrack>, rowsTitle: String, root: GlanceModifier) {
    Column(root) {
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Art(context, hero.track, 88)
        Spacer(GlanceModifier.width(14.dp))
        Column(GlanceModifier.defaultWeight()) {
          Eyebrow(eyebrow(hero))
          Text(hero.track.surahName, maxLines = 1, style = TextStyle(color = WHITE, fontSize = 20.sp, fontWeight = FontWeight.Bold))
          Text(hero.track.reciterName, maxLines = 1, style = TextStyle(color = SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Medium))
          Spacer(GlanceModifier.height(6.dp))
          PlayButton(context, hero, 40)
        }
      }
      if (hero.hasNowPlaying) {
        Spacer(GlanceModifier.height(12.dp))
        Progress(hero.progress, GlanceModifier.fillMaxWidth())
        Spacer(GlanceModifier.height(3.dp))
        TimeLeft(hero)
      }
      if (rows.isNotEmpty()) {
        Spacer(GlanceModifier.height(10.dp))
        Spacer(GlanceModifier.fillMaxWidth().height(1.dp).background(ColorProvider(Color(0x24FFFFFF))))
        Spacer(GlanceModifier.height(10.dp))
        Eyebrow(rowsTitle)
        rows.forEach { t -> TrackRow(context, t, 36) }
      }
    }
  }

  private fun playTrackCommand(t: WidgetTrack): JSONObject =
    JSONObject().put("type", "playTrack").put("surahId", t.surahId)
      .put("reciterId", t.reciterId).put("rewayatId", t.rewayatId ?: JSONObject.NULL).put("ayah", JSONObject.NULL)

  @Composable
  private fun TrackRow(context: Context, t: WidgetTrack, art: Int) {
    val cmd = playTrackCommand(t)
    val base = if (t.isUserUpload || t.surahId == 0) GlanceModifier else GlanceModifier.clickable(
      actionStartActivity(
        WidgetCommandActivity.intent(context, cmd)
          .setData(Uri.parse("bayaan-widget://row/${t.surahId}/${t.reciterId}")),
      ),
    )
    Row(base.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
      Art(context, t, art)
      Spacer(GlanceModifier.width(10.dp))
      Column(GlanceModifier.defaultWeight()) {
        Text(t.surahName, maxLines = 1, style = TextStyle(color = WHITE, fontSize = 13.sp, fontWeight = FontWeight.Bold))
        Text(t.reciterName, maxLines = 1, style = TextStyle(color = SECONDARY, fontSize = 11.sp))
      }
      Image(ImageProvider(R.drawable.widget_play), contentDescription = null,
        colorFilter = ColorFilter.tint(SECONDARY), modifier = GlanceModifier.size(14.dp))
    }
  }
  // @ai-end
}
