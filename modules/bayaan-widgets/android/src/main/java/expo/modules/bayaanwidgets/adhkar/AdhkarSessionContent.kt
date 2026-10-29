// adhkar/AdhkarSessionContent.kt
package expo.modules.bayaanwidgets.adhkar

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ColumnScope
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
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
import expo.modules.bayaanwidgets.AdhkarPeriodData
import expo.modules.bayaanwidgets.AdhkarSession
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.RingBitmap
import expo.modules.bayaanwidgets.SessionDhikr
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.dpToPx
import kotlin.math.ceil

private val CAPTION = ColorProvider(Color(0xB3FFFFFF))
private const val HEADER_DP = 20f
private const val PROGRESS_DP = 3f
private const val CONTROLS_DP = 34f
private const val CAPTION_DP = 15f
private const val TRANSLATION_LINE_DP = 16f
private const val TRANSLATION_CHAR_DP = 6f

/**
 * Medium and large Adhkar: card through the session (spec 2026-10-12). Mirrors AdhkarSessionView.swift.
 * Buttons and the ring run actions; the caller's root click opens the adhkar screen at the current dhikr.
 * Medium has no progress bar and puts the "read the rest" hint in the controls row so the dhikr gets two lines.
 * The 110 dp medium (dense launchers, Bayaan Now) is shorter than iOS medium, so it tightens padding and gaps
 * and shows one line.
 */
@Composable
fun AdhkarSessionContent(context: Context, data: AdhkarPeriodData, session: AdhkarSession, large: Boolean) {
  val size = LocalSize.current
  val compact = !large && size.height < WidgetSizes.MEDIUM_TALL.height
  val pad = if (large) 16 else if (compact) 10 else 12
  val gap = if (large) 10 else if (compact) 4 else 6
  val item: SessionDhikr? = data.items.getOrNull(session.index)
  Column(GlanceModifier.fillMaxSize().padding(pad.dp)) {
    // Gaps are paddings where possible: Glance renders at most 10 children per Column.
    Row(GlanceModifier.fillMaxWidth().padding(bottom = (if (compact) 4 else 6).dp), verticalAlignment = Alignment.CenterVertically) {
      Text(data.title, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
        style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Bold))
      if (!session.completed) {
        Text("${session.index + 1} of ${data.items.size}",
          style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp, fontWeight = FontWeight.Medium))
        Spacer(GlanceModifier.width(8.dp))
      }
      Logo(14)
    }
    if (large) {
      LinearProgressIndicator(
        progress = if (session.completed) 1f else session.index.toFloat() / maxOf(1, data.items.size),
        modifier = GlanceModifier.fillMaxWidth().height(PROGRESS_DP.dp),
        color = WidgetColors.WHITE, backgroundColor = ColorProvider(Color(0x38FFFFFF)),
      )
    }
    Spacer(GlanceModifier.height(gap.dp))
    if (session.completed || item == null) {
      Completed(data, large)
      return@Column
    }
    val textWidth = size.width.value - pad * 2
    val cut = large && item.largeCut
    val hint = !large && item.mediumCut
    val translation = if (large) item.translation else null
    val translationLines = translation?.let { minOf(3, ceil(it.length * TRANSLATION_CHAR_DP / textWidth).toInt()) } ?: 0
    val fixed = HEADER_DP + (if (compact) 4 else 6) + (if (large) PROGRESS_DP else 0f) + gap + gap + CONTROLS_DP +
      (if (cut) gap + CAPTION_DP else 0f) + (if (translationLines > 0) gap + translationLines * TRANSLATION_LINE_DP else 0f)
    val textHeight = (size.height.value - pad * 2 - fixed).coerceAtLeast(22f)
    Spacer(GlanceModifier.defaultWeight())
    ArabicText(context, if (large) item.largeText else item.mediumText, ArabicBitmap.DHIKR_FONT, textWidth, textHeight,
      if (large) 22f else 18f, 11f, if (large) 9 else if (compact) 1 else 2, center = true, wholeLines = true)
    if (translation != null) {
      Text(translation, maxLines = 3, modifier = GlanceModifier.padding(top = gap.dp), style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
    }
    if (cut) {
      Text(readTheRest(context), maxLines = 1, modifier = GlanceModifier.padding(top = gap.dp),
        style = TextStyle(color = CAPTION, fontSize = 11.sp, fontWeight = FontWeight.Medium))
    }
    Spacer(GlanceModifier.defaultWeight())
    Row(GlanceModifier.fillMaxWidth().padding(top = gap.dp), verticalAlignment = Alignment.CenterVertically) {
      if (session.index > 0) RoundButton(R.drawable.widget_prev, "Previous", actionRunCallback<AdhkarPrevAction>())
      if (hint) {
        Text(readTheRest(context), maxLines = 1, modifier = GlanceModifier.defaultWeight().padding(horizontal = 8.dp),
          style = TextStyle(color = CAPTION, fontSize = 10.sp, fontWeight = FontWeight.Medium))
      } else {
        Spacer(GlanceModifier.defaultWeight())
      }
      CounterRing(context, session.remaining, item.repeatCount, CONTROLS_DP.toInt())
      Spacer(GlanceModifier.width(12.dp))
      RoundButton(R.drawable.widget_next, "Next", actionRunCallback<AdhkarNextAction>())
    }
  }
}

private fun readTheRest(context: Context): String = "Read the rest in ${AppBrand.name(context)} →"

/** Small repetition ring: fills as you count, a check for a dhikr said once. Tapping counts. */
@Composable
private fun CounterRing(context: Context, remaining: Int, total: Int, sizeDp: Int) {
  val px = dpToPx(context, sizeDp)
  val progress = if (total > 1) (total - remaining).toFloat() / total else 0f
  val bmp = remember(remaining, total, px) { RingBitmap.render(px, px * 0.09f, progress, android.graphics.Color.WHITE, 0x33FFFFFF) }
  Box(GlanceModifier.size(sizeDp.dp).clickable(actionRunCallback<AdhkarCountAction>()), contentAlignment = Alignment.Center) {
    Image(ImageProvider(bmp), contentDescription = if (total > 1) "Count, $remaining left" else "Said once, next", modifier = GlanceModifier.fillMaxSize())
    Text(if (total > 1) "$remaining" else "✓",
      style = TextStyle(color = WidgetColors.WHITE, fontSize = (sizeDp * 0.38f).sp, fontWeight = FontWeight.Bold))
  }
}

@Composable
private fun ColumnScope.Completed(data: AdhkarPeriodData, large: Boolean) {
  Column(GlanceModifier.fillMaxWidth().defaultWeight(), horizontalAlignment = Alignment.CenterHorizontally) {
    Spacer(GlanceModifier.defaultWeight())
    val check = if (large) 40 else 28
    Image(ImageProvider(R.drawable.widget_check_circle), contentDescription = null, modifier = GlanceModifier.size(check.dp))
    Spacer(GlanceModifier.height(8.dp))
    Text("${data.title} completed", maxLines = 1,
      style = TextStyle(color = WidgetColors.WHITE, fontSize = 14.sp, fontWeight = FontWeight.Medium))
    Spacer(GlanceModifier.height(8.dp))
    Box(
      GlanceModifier.background(WidgetColors.TILE).cornerRadius(14.dp).padding(horizontal = 12.dp, vertical = 6.dp)
        .clickable(actionRunCallback<AdhkarRestartAction>()),
      contentAlignment = Alignment.Center,
    ) {
      Text("Start again", style = TextStyle(color = WidgetColors.WHITE, fontSize = 12.sp, fontWeight = FontWeight.Bold))
    }
    Spacer(GlanceModifier.defaultWeight())
  }
}
