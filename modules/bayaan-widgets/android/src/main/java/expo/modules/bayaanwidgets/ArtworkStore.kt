package expo.modules.bayaanwidgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

object ArtworkStore {
  private const val SIDE = 300
  private const val TIMEOUT_MS = 10_000

  /** Downloads or copies, center-crops to 300x300, writes JPEG. Runs off the main thread. */
  fun cache(context: Context, sourceUrl: String, fileName: String): Boolean = try {
    val uri = Uri.parse(sourceUrl)
    val input = when (uri.scheme) {
      "http", "https" -> null
      "file" -> File(requireNotNull(uri.path)).inputStream()
      else -> context.contentResolver.openInputStream(uri)
    }
    val src = (if (input == null) download(sourceUrl) else input.use { BitmapFactory.decodeStream(it) })
      ?: throw IllegalStateException("decode")
    val side = minOf(src.width, src.height)
    val cropped = Bitmap.createBitmap(src, (src.width - side) / 2, (src.height - side) / 2, side, side)
    val scaled = Bitmap.createScaledBitmap(cropped, SIDE, SIDE, true)
    FileOutputStream(File(WidgetStorage.artworkDir(context), fileName)).use {
      scaled.compress(Bitmap.CompressFormat.JPEG, 85, it)
    }
    true
  } catch (e: Exception) {
    false
  }

  private fun download(sourceUrl: String): Bitmap? {
    val conn = URL(sourceUrl).openConnection() as HttpURLConnection
    return try {
      conn.connectTimeout = TIMEOUT_MS
      conn.readTimeout = TIMEOUT_MS
      if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
      conn.inputStream.use { stream: InputStream -> BitmapFactory.decodeStream(stream) }
    } finally {
      conn.disconnect()
    }
  }
}
