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
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
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

class ContinueListeningWidget : GlanceAppWidget() {
  companion object {
    private val SMALL = DpSize(110.dp, 110.dp)
    private val MEDIUM = DpSize(250.dp, 110.dp)
    private val LARGE = DpSize(250.dp, 250.dp)

    // Fixed near-black, like Podcasts and Spotify: the artwork is the only color.
    private val BACKGROUND = ColorProvider(Color(0xFF1C1C1E))
    private val WHITE = ColorProvider(Color.White)

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

  @Composable
  private fun Content(context: Context, s: WidgetSnapshot?, override: PlaybackOverride?) {
    val track = s?.nowPlaying?.track ?: s?.recent?.firstOrNull() ?: s?.upNext?.firstOrNull()
    val openPlayer = actionStartActivity(
      Intent(Intent.ACTION_VIEW, Uri.parse(AppLinks.url(context, "player"))).setPackage(context.packageName),
    )

    Box(
      modifier = GlanceModifier.fillMaxSize().background(BACKGROUND).cornerRadius(20.dp)
        .padding(14.dp).clickable(openPlayer),
    ) {
      if (s == null || track == null) {
        Column(GlanceModifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally,
          verticalAlignment = Alignment.CenterVertically) {
          Logo(24)
          Spacer(GlanceModifier.height(8.dp))
          Text("Start listening", style = TextStyle(color = WHITE, fontWeight = FontWeight.Medium))
        }
        return@Box
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
      )
      // Drop the side list's first item when it is already the hero.
      val sideSource =
        if (s.upNext.isEmpty()) s.recent.drop(if (s.nowPlaying == null) 1 else 0)
        else s.upNext.drop(if (s.nowPlaying == null && s.recent.isEmpty()) 1 else 0)
      val sideTitle = if (s.upNext.isEmpty()) "Recent" else "Up next"
      when {
        size.width >= MEDIUM.width && size.height >= LARGE.height -> Large(context, hero, sideSource.take(4), sideTitle)
        size.width >= MEDIUM.width -> Medium(context, hero, sideSource.take(3), sideTitle)
        else -> Small(context, hero)
      }
    }
  }

  /** Everything the hero needs, resolved once per composition. */
  private class Hero(
    val track: WidgetTrack,
    val hasNowPlaying: Boolean,
    val isPlaying: Boolean,
    val progress: Float?,
  )

  @Composable
  private fun Art(context: Context, file: String?, size: Int) {
    val cache = LocalArtCache.current
    val px = maxOf(1, (size * context.resources.displayMetrics.density).roundToInt())
    val bmp = file?.let { name ->
      cache.getOrPut("$name@$px") {
        File(WidgetStorage.artworkDir(context), name).takeIf { it.exists() }?.let { decodeArt(it, px) }
      }
    }
    if (bmp != null) {
      Image(
        ImageProvider(bmp), contentDescription = null,
        modifier = GlanceModifier.size(size.dp).cornerRadius((size / 6).dp),
        contentScale = ContentScale.Crop,
      )
    } else {
      Spacer(GlanceModifier.size(size.dp).background(ColorProvider(Color(0x26FFFFFF))).cornerRadius((size / 6).dp))
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
   * Round play/pause button. With nothing loaded (the hero is a recent item or
   * the surah of the day), it starts that track.
   */
  @Composable
  private fun PlayButton(context: Context, hero: Hero) {
    val track = hero.track
    val cmd = when {
      // Absolute target: the opposite of what is rendered.
      hero.hasNowPlaying -> JSONObject().put("type", "setPlayback").put("playing", !hero.isPlaying)
      track.isUserUpload || track.surahId == 0 -> return
      else -> playTrackCommand(track)
    }
    Box(
      GlanceModifier.size(30.dp).background(ColorProvider(Color(0x2EFFFFFF))).cornerRadius(15.dp).clickable(
        actionStartActivity(
          WidgetCommandActivity.intent(context, cmd)
            .setData(Uri.parse("bayaan-widget://hero/${cmd.toString().hashCode()}")),
        ),
      ),
      contentAlignment = Alignment.Center,
    ) {
      Image(
        ImageProvider(if (hero.isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play),
        contentDescription = if (hero.isPlaying) "Pause" else "Play",
        modifier = GlanceModifier.size(18.dp),
      )
    }
  }

  /** Spotify-style thin bar on a faint track. Static: refreshed on each push. */
  @Composable
  private fun Progress(progress: Float?, modifier: GlanceModifier) {
    if (progress == null) return
    LinearProgressIndicator(
      progress = progress, modifier = modifier.height(3.dp),
      color = WHITE, backgroundColor = ColorProvider(Color(0x38FFFFFF)),
    )
  }

  @Composable
  private fun Titles(track: WidgetTrack, titleSp: Int) {
    Text(track.surahName, maxLines = 1, style = TextStyle(color = WHITE, fontSize = titleSp.sp, fontWeight = FontWeight.Bold))
    Text(track.reciterName, maxLines = 1, style = TextStyle(color = ColorProvider(Color(0xBFFFFFFF)), fontSize = 12.sp))
  }

  @Composable
  private fun ListHeader(title: String?) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      if (title != null) {
        Text(title, maxLines = 1, style = TextStyle(color = ColorProvider(Color(0x99FFFFFF)), fontSize = 11.sp, fontWeight = FontWeight.Bold))
      }
      Spacer(GlanceModifier.defaultWeight())
      Logo(14)
    }
  }

  @Composable
  private fun Small(context: Context, hero: Hero) {
    Column(GlanceModifier.fillMaxSize()) {
      Row(GlanceModifier.fillMaxWidth()) {
        Art(context, hero.track.artworkFile, 44)
        Spacer(GlanceModifier.defaultWeight())
        Logo(14)
      }
      Spacer(GlanceModifier.defaultWeight())
      Titles(hero.track, 15)
      Spacer(GlanceModifier.height(6.dp))
      PlayerRow(context, hero)
    }
  }

  /** Play button beside the progress bar. */
  @Composable
  private fun PlayerRow(context: Context, hero: Hero) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      PlayButton(context, hero)
      Spacer(GlanceModifier.width(10.dp))
      Progress(hero.progress, GlanceModifier.defaultWeight())
    }
  }

  @Composable
  private fun Medium(context: Context, hero: Hero, side: List<WidgetTrack>, sideTitle: String) {
    Row(GlanceModifier.fillMaxSize()) {
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        Art(context, hero.track.artworkFile, 52)
        Spacer(GlanceModifier.defaultWeight())
        Titles(hero.track, 15)
        Spacer(GlanceModifier.height(6.dp))
        PlayerRow(context, hero)
      }
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight()) {
        ListHeader(if (side.isEmpty()) null else sideTitle)
        Spacer(GlanceModifier.height(2.dp))
        side.forEach { t -> TrackRow(context, t, 30) }
      }
    }
  }

  @Composable
  private fun Large(context: Context, hero: Hero, rows: List<WidgetTrack>, rowsTitle: String) {
    Column(GlanceModifier.fillMaxSize()) {
      Row(GlanceModifier.fillMaxWidth()) {
        Art(context, hero.track.artworkFile, 72)
        Spacer(GlanceModifier.width(12.dp))
        Column(GlanceModifier.defaultWeight().padding(top = 6.dp)) { Titles(hero.track, 18) }
        Logo(16)
      }
      Spacer(GlanceModifier.height(12.dp))
      PlayerRow(context, hero)
      Spacer(GlanceModifier.height(12.dp))
      if (rows.isNotEmpty()) {
        Text(rowsTitle, maxLines = 1, style = TextStyle(color = ColorProvider(Color(0x99FFFFFF)), fontSize = 11.sp, fontWeight = FontWeight.Bold))
      }
      rows.forEach { t -> TrackRow(context, t, 34) }
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
    Row(base.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
      Art(context, t.artworkFile, art)
      Spacer(GlanceModifier.width(8.dp))
      Column { Titles(t, 13) }
    }
  }
}
