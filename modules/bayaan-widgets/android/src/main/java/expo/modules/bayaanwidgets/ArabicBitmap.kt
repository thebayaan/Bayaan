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
  private const val STEP_PX = 2f
  private val typefaces = HashMap<String, Typeface>()

  private fun typeface(context: Context, asset: String): Typeface? = synchronized(typefaces) {
    typefaces[asset] ?: runCatching { Typeface.createFromAsset(context.assets, asset) }.getOrNull()
      ?.also { typefaces[asset] = it }
  }

  /** Shrinks from maxTextPx toward minTextPx until the text fits; ellipsizes at minTextPx. */
  fun render(
    context: Context, text: String, fontAsset: String, widthPx: Int, maxHeightPx: Int,
    maxTextPx: Float, minTextPx: Float, color: Int, center: Boolean, maxLines: Int,
  ): Bitmap? {
    if (text.isBlank() || widthPx <= 0 || maxHeightPx <= 0) return null
    val face = typeface(context, fontAsset) ?: return null
    val paint = TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply {
      typeface = face
      this.color = color
    }
    val alignment = if (center) Layout.Alignment.ALIGN_CENTER else Layout.Alignment.ALIGN_NORMAL
    fun layoutAt(px: Float): StaticLayout {
      paint.textSize = px
      return StaticLayout.Builder.obtain(text, 0, text.length, paint, widthPx)
        .setAlignment(alignment)
        .setTextDirection(TextDirectionHeuristics.RTL)
        .setMaxLines(maxLines)
        .setEllipsize(TextUtils.TruncateAt.END)
        .setIncludePad(true)
        .build()
    }
    val size = TextFit.largestFitting(maxTextPx, minTextPx, STEP_PX) { px ->
      val l = layoutAt(px)
      l.height <= maxHeightPx && l.getEllipsisCount(l.lineCount - 1) == 0
    }
    val layout = layoutAt(size)
    val bmp = Bitmap.createBitmap(widthPx, layout.height.coerceIn(1, maxHeightPx), Bitmap.Config.ARGB_8888)
    bmp.density = context.resources.displayMetrics.densityDpi
    layout.draw(Canvas(bmp))
    return bmp
  }
}
