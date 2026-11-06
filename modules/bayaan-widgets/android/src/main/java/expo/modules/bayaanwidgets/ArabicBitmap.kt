package expo.modules.bayaanwidgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import android.text.TextUtils

/**
 * Glance cannot use custom fonts, so Arabic is drawn to a bitmap with
 * StaticLayout (HarfBuzz shaping) and shown as an image.
 */
object ArabicBitmap {
  const val QURAN_FONT = "fonts/DigitalKhattFont.otf"
  const val DHIKR_FONT = "fonts/ScheherazadeNew-Regular.ttf"
  const val SURAH_NAMES_FONT = "fonts/surah_names.ttf" // @ai
  private const val STEP_PX = 2f
  private val typefaces = HashMap<String, Typeface>()

  private fun typeface(context: Context, asset: String): Typeface? = synchronized(typefaces) {
    typefaces[asset] ?: runCatching { Typeface.createFromAsset(context.assets, asset) }.getOrNull()
      ?.also { typefaces[asset] = it }
  }

  /**
   * Shrinks from maxTextPx toward minTextPx until the text fits; ellipsizes at minTextPx.
   * With wholeLines, text still too tall at minTextPx drops lines and ends on an ellipsis instead of being cropped mid-line.
   */
  fun render(
    context: Context, text: String, fontAsset: String, widthPx: Int, maxHeightPx: Int,
    maxTextPx: Float, minTextPx: Float, color: Int, center: Boolean, maxLines: Int, wholeLines: Boolean = false,
  ): Bitmap? {
    if (text.isBlank() || widthPx <= 0 || maxHeightPx <= 0) return null
    val face = typeface(context, fontAsset) ?: return null
    val paint = TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply {
      typeface = face
      this.color = color
    }
    val alignment = if (center) Layout.Alignment.ALIGN_CENTER else Layout.Alignment.ALIGN_NORMAL
    fun layoutAt(px: Float, lines: Int = maxLines): StaticLayout {
      paint.textSize = px
      return StaticLayout.Builder.obtain(text, 0, text.length, paint, widthPx)
        .setAlignment(alignment)
        .setTextDirection(TextDirectionHeuristics.RTL)
        .setMaxLines(lines)
        .setEllipsize(TextUtils.TruncateAt.END)
        .setIncludePad(true)
        .build()
    }
    val size = TextFit.largestFitting(maxTextPx, minTextPx, STEP_PX) { px ->
      val l = layoutAt(px)
      l.height <= maxHeightPx && l.getEllipsisCount(l.lineCount - 1) == 0
    }
    var layout = layoutAt(size)
    var lines = layout.lineCount
    while (wholeLines && layout.height > maxHeightPx && lines > 1) {
      lines -= 1
      layout = layoutAt(size, lines)
    }
    val bmp = Bitmap.createBitmap(widthPx, layout.height.coerceIn(1, maxHeightPx), Bitmap.Config.ARGB_8888)
    bmp.density = context.resources.displayMetrics.densityDpi
    layout.draw(Canvas(bmp))
    return bmp
  }
}
