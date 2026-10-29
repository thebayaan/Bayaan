package expo.modules.bayaanwidgets

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF

/** Tasbeeh progress ring; Glance's CircularProgressIndicator is indeterminate only. */
object RingBitmap {
  fun render(sizePx: Int, strokePx: Float, progress: Float, color: Int, trackColor: Int): Bitmap {
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val inset = strokePx / 2f
    val rect = RectF(inset, inset, sizePx - inset, sizePx - inset)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = strokePx
      strokeCap = Paint.Cap.ROUND
    }
    paint.color = trackColor
    canvas.drawArc(rect, 0f, 360f, false, paint)
    val sweep = 360f * progress.coerceIn(0f, 1f)
    if (sweep > 0f) {
      paint.color = color
      canvas.drawArc(rect, -90f, sweep, false, paint)
    }
    return bmp
  }

  // @ai-start
  /** A ring of `beads` dots, the first `filled` in `color`, like a misbaha. */
  fun beads(sizePx: Int, beads: Int, filled: Int, color: Int, trackColor: Int): Bitmap {
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val dot = sizePx * 0.028f
    val radius = sizePx / 2f - dot * 1.2f
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    for (i in 0 until beads) {
      val angle = Math.toRadians(-90.0 + i * 360.0 / beads)
      paint.color = if (i < filled) color else trackColor
      canvas.drawCircle(
        sizePx / 2f + (radius * Math.cos(angle)).toFloat(), sizePx / 2f + (radius * Math.sin(angle)).toFloat(), dot, paint,
      )
    }
    return bmp
  }
  // @ai-end
}
