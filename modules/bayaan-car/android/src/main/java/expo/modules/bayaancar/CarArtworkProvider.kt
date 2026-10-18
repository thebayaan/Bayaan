package expo.modules.bayaancar

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Serves car artwork to Android Auto. Exported but read-only; every key is
 * validated, network fetches are limited to https URLs present in the current
 * snapshot (plus `{surahArtworkBase}{id}.png`), and the on-disk cache is bounded.
 */
class CarArtworkProvider : ContentProvider() {
  companion object {
    private const val TIMEOUT_MS = 10_000
    private const val STALE_TMP_MS = 10 * 60 * 1000L

    @Volatile private var authority: String? = null
    private const val LOCK_STRIPES = 64
    private const val DOWNLOAD_DEADLINE_MS = 15_000L
    private val locks = Array(LOCK_STRIPES) { Any() }

    // Writes tile PNGs into their pipes; small and fixed so callers cannot spawn threads.
    private val tileWriter: ExecutorService = Executors.newFixedThreadPool(2) { r ->
      Thread(r, "bayaan-car-tile").apply { isDaemon = true }
    }
    private fun lockFor(name: String): Any = locks[(name.hashCode() and Int.MAX_VALUE) % LOCK_STRIPES]

    // Lazily loaded snapshot for a cold process (no JS yet); retried at most every few seconds.
    private val loadLock = Any()
    @Volatile private var loaded: CarSnapshot? = null
    private var lastLoadAttempt = 0L

    // Cached allowlist, rebuilt only when the snapshot or now playing instance changes.
    private class Allow(val snapshot: CarSnapshot?, val nowPlaying: CarNowPlaying?, val urls: Set<String>)
    @Volatile private var allow: Allow? = null

    fun uriFor(artwork: CarArtwork): Uri? {
      val auth = authority ?: return null
      val key = when (artwork) {
        is CarArtwork.Icon -> CarArtworkKeys.iconKey(artwork.name, artwork.hex) ?: return null
        is CarArtwork.Surah -> "surah-${artwork.surahId}"
        is CarArtwork.Url -> "url-" + encode(artwork.url)
        is CarArtwork.Asset -> "asset-" + encode(artwork.uri)
        is CarArtwork.Monogram -> "tile-" + encode("${artwork.label}|${artwork.hex}")
        is CarArtwork.Color -> "tile-" + encode("${artwork.label}|${artwork.hex}")
      }
      if (CarArtworkKeys.parseKey(key) == null) return null
      return Uri.parse("content://$auth/$key")
    }

    private fun encode(s: String): String =
      Base64.encodeToString(s.toByteArray(Charsets.UTF_8), Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)

    private fun decode(s: String): String? = runCatching {
      String(Base64.decode(s, Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING), Charsets.UTF_8)
    }.getOrNull()

    private fun currentSnapshot(ctx: Context): CarSnapshot? {
      CarBridge.snapshot?.let { return it }
      loaded?.let { return it }
      synchronized(loadLock) {
        loaded?.let { return it }
        val now = SystemClock.elapsedRealtime()
        if (lastLoadAttempt != 0L && now - lastLoadAttempt < 5_000) return null
        lastLoadAttempt = now
        return CarBridge.loadSnapshotBlocking(ctx).also { loaded = it }
      }
    }

    private fun allowedUrls(ctx: Context): Set<String> {
      val snapshot = currentSnapshot(ctx)
      val nowPlaying = CarBridge.nowPlaying
      val cached = allow
      if (cached != null && cached.snapshot === snapshot && cached.nowPlaying === nowPlaying) return cached.urls
      val urls = CarArtworkKeys.allowedUrls(snapshot, nowPlaying)
      allow = Allow(snapshot, nowPlaying, urls)
      return urls
    }
  }

  override fun onCreate(): Boolean {
    val ctx = context ?: return false
    authority = "${ctx.packageName}.bayaancar.artwork"
    return true
  }

  private fun cacheDir(): File? {
    val ctx = context ?: return null
    return File(ctx.cacheDir, "bayaan-car/artwork").also { it.mkdirs() }
  }

  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? {
    if (mode != "r") return null
    val keyString = uri.pathSegments.singleOrNull() ?: return null
    val key = CarArtworkKeys.parseKey(keyString) ?: return null
    if (key is ArtworkKey.Tile || key is ArtworkKey.Icon) return openTile(key)
    val dir = cacheDir() ?: return null
    // Surah files are keyed by base too, so a new artwork base never serves stale cards.
    val name = if (key is ArtworkKey.Surah) {
      CarArtworkKeys.fileNameFor("$keyString|${CarArtworkKeys.surahUrl(currentSnapshot(context ?: return null)?.surahArtworkBase, key.surahId)}")
    } else {
      CarArtworkKeys.fileNameFor(keyString)
    }
    val file = File(dir, name)
    val lock = lockFor(name)
    synchronized(lock) {
      if (!file.isFile) {
        val bitmap = render(key) ?: return null
        if (!writeAtomically(dir, file, bitmap)) return null
        evict(dir)
      } else {
        file.setLastModified(System.currentTimeMillis())
      }
      return runCatching { ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY) }.getOrNull()
    }
  }

  /** Tiles and icons are cheap to draw, so they are streamed through a pipe and never cached on disk. */
  private fun openTile(key: ArtworkKey): ParcelFileDescriptor? {
    val bitmap = render(key) ?: return null
    val pipe = runCatching { ParcelFileDescriptor.createPipe() }.getOrNull() ?: return null
    val submitted = runCatching {
      tileWriter.execute {
        runCatching {
          ParcelFileDescriptor.AutoCloseOutputStream(pipe[1]).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
      }
    }
    if (submitted.isFailure) {
      runCatching { pipe[0].close() }
      runCatching { pipe[1].close() }
      return null
    }
    return pipe[0]
  }

  private fun writeAtomically(dir: File, target: File, bitmap: Bitmap): Boolean {
    val tmp = File(dir, "${UUID.randomUUID()}.tmp")
    return try {
      FileOutputStream(tmp).use { if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) return false }
      if (!tmp.renameTo(target)) return false
      true
    } catch (e: Exception) {
      CarLog.d("artwork write failed: $e")
      false
    } finally {
      tmp.delete()
    }
  }

  private fun evict(dir: File) {
    val all = dir.listFiles() ?: return
    val now = System.currentTimeMillis()
    all.filter { it.name.endsWith(".tmp") && now - it.lastModified() > STALE_TMP_MS }.forEach { it.delete() }
    val pngs = all.filter { it.name.endsWith(".png") }
    val doomed = CarArtworkKeys.evictionOrder(pngs.map { it.name to (it.lastModified() to it.length()) })
    doomed.forEach { File(dir, it).delete() }
  }

  private fun render(key: ArtworkKey): Bitmap? = when (key) {
    is ArtworkKey.Surah -> context?.let { ctx ->
      download(CarArtworkKeys.surahUrl(currentSnapshot(ctx)?.surahArtworkBase, key.surahId))
    }
    is ArtworkKey.Url -> decode(key.encoded)?.let { fetchIfAllowed(it) }
    is ArtworkKey.Asset -> decode(key.encoded)?.let { asset(it) }
    is ArtworkKey.Tile -> decode(key.encoded)?.let { d ->
      val (label, hex) = CarArtworkKeys.parseTile(d)
      tile(label, hex)
    }
    is ArtworkKey.Icon -> icon(key)
  }

  /** Android Auto is dark, so the dark tile variants are used. */
  private fun iconDrawable(name: String): Int? = when (name) {
    "loved" -> R.drawable.car_icon_loved
    "playlists" -> R.drawable.car_icon_playlists
    "downloads" -> R.drawable.car_icon_downloads
    "uploads" -> R.drawable.car_icon_uploads
    "reciters" -> R.drawable.car_icon_reciters
    "random" -> R.drawable.car_icon_random
    CarArtworkKeys.PLAYLIST -> R.drawable.car_icon_playlist_glyph
    else -> null
  }

  /** A bundled tile, or for a playlist its colour with the white glyph on top. */
  private fun icon(key: ArtworkKey.Icon): Bitmap? {
    val ctx = context ?: return null
    val id = iconDrawable(key.name) ?: return null
    val decoded = BitmapFactory.decodeResource(ctx.resources, id) ?: return null
    val size = CarArtworkKeys.SIZE
    val glyph = if (decoded.width == size && decoded.height == size) decoded else Bitmap.createScaledBitmap(decoded, size, size, true)
    if (key.name != CarArtworkKeys.PLAYLIST) return glyph
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#" + (key.hex ?: CarArtworkKeys.DEFAULT_PLAYLIST_HEX))
    }
    val radius = size * CarArtworkKeys.ICON_CORNER_RATIO
    canvas.drawRoundRect(RectF(0f, 0f, size.toFloat(), size.toFloat()), radius, radius, paint)
    canvas.drawBitmap(glyph, 0f, 0f, null)
    return bitmap
  }

  private fun fetchIfAllowed(url: String): Bitmap? {
    val ctx = context ?: return null
    if (!CarArtworkKeys.isHttps(url) || url !in allowedUrls(ctx)) return null
    return download(url)
  }

  private fun download(url: String): Bitmap? {
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(url).openConnection() as? HttpURLConnection) ?: return null
      conn.connectTimeout = TIMEOUT_MS
      conn.readTimeout = TIMEOUT_MS
      conn.instanceFollowRedirects = false
      if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
      if (conn.contentLengthLong > CarArtworkKeys.MAX_DOWNLOAD_BYTES) return null
      val bytes = readCapped(conn) ?: return null
      decodeSquare(bytes)
    } catch (e: Exception) {
      CarLog.d("artwork download failed: $e")
      null
    } finally {
      conn?.disconnect()
    }
  }

  private fun readCapped(conn: HttpURLConnection): ByteArray? {
    val out = ByteArrayOutputStream()
    val deadline = SystemClock.elapsedRealtime() + DOWNLOAD_DEADLINE_MS
    val buf = ByteArray(16 * 1024)
    conn.inputStream.use { input ->
      while (true) {
        val n = input.read(buf)
        if (n < 0) break
        if (SystemClock.elapsedRealtime() > deadline) return null
        if (out.size() + n > CarArtworkKeys.MAX_DOWNLOAD_BYTES) return null
        out.write(buf, 0, n)
      }
    }
    return out.toByteArray()
  }

  /** Downsamples while decoding, center-crops to a square and scales to SIZE. */
  private fun decodeSquare(bytes: ByteArray): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (!CarArtworkKeys.isDecodable(bounds.outWidth, bounds.outHeight)) return null
    val opts = BitmapFactory.Options().apply { inSampleSize = CarArtworkKeys.sampleSize(bounds.outWidth, bounds.outHeight) }
    return try {
      val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts) ?: return null
      squareScaled(decoded)
    } catch (e: OutOfMemoryError) {
      CarLog.d("artwork decode OOM")
      null
    }
  }

  private fun squareScaled(src: Bitmap): Bitmap {
    val (left, top, side) = CarArtworkKeys.centerSquare(src.width, src.height)
    val square = if (side == src.width && side == src.height) src else Bitmap.createBitmap(src, left, top, side, side)
    return if (side == CarArtworkKeys.SIZE) square else Bitmap.createScaledBitmap(square, CarArtworkKeys.SIZE, CarArtworkKeys.SIZE, true)
  }

  private fun asset(uri: String): Bitmap? {
    if (uri.startsWith("http")) return fetchIfAllowed(uri)
    if (!CarArtworkKeys.isValidDrawableName(uri)) return null
    val ctx = context ?: return null
    val id = ctx.resources.getIdentifier(uri, "drawable", ctx.packageName)
    if (id == 0) return null
    val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeResource(ctx.resources, id, opts)
    if (!CarArtworkKeys.isDecodable(opts.outWidth, opts.outHeight)) return null
    val sample = CarArtworkKeys.sampleSize(opts.outWidth, opts.outHeight)
    val decoded = BitmapFactory.decodeResource(ctx.resources, id, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    return squareScaled(decoded)
  }

  private fun tile(label: String, hex: String): Bitmap {
    val size = CarArtworkKeys.SIZE
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(runCatching { Color.parseColor(hex) }.getOrDefault(Color.parseColor(CarArtworkKeys.DEFAULT_TILE_HEX)))
    val text = CarArtworkKeys.tileText(label)
    if (text.isEmpty()) return bitmap
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = size * 0.3f
      textAlign = Paint.Align.CENTER
      isFakeBoldText = true
    }
    val y = size / 2f - (paint.descent() + paint.ascent()) / 2f
    canvas.drawText(text, size / 2f, y, paint)
    return bitmap
  }

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String? =
    if (CarArtworkKeys.parseKey(uri.pathSegments.singleOrNull()) != null) "image/png" else null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
