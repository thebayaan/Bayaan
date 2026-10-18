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
}
