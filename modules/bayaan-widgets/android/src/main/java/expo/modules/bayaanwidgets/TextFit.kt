package expo.modules.bayaanwidgets

object TextFit {
  /** Largest size from maxPx down to minPx, in stepPx steps, that fits; minPx when none does. */
  fun largestFitting(maxPx: Float, minPx: Float, stepPx: Float, fits: (Float) -> Boolean): Float {
    if (stepPx <= 0f || maxPx <= minPx) return minPx
    var px = maxPx
    while (px > minPx) {
      if (fits(px)) return px
      px -= stepPx
    }
    return minPx
  }
}
