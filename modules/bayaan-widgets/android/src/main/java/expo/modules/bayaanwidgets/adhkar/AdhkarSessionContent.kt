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
import androidx.glance.ColorFilter
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
import expo.modules.bayaanwidgets.ui.adhkarListenAction
import kotlin.math.ceil

private val CAPTION = ColorProvider(Color(0xB3FFFFFF))
private const val HEADER_DP = 20f
private const val PROGRESS_DP = 3f
private const val CONTROLS_DP = 34f
private const val CAPTION_DP = 15f
private const val TRANSLATION_LINE_DP = 16f
private const val TRANSLATION_CHAR_DP = 6f

// @ai-start
/** Adhkar tinted by time of day: dawn paper in the morning, dusk ink in the evening. Mirrors AdhkarStyle on iOS. */
class AdhkarStyle(
  val background: Int, val primary: Int, val secondary: Int, val accent: Int, val onAccent: Int, val track: Int,
  val symbol: Int,
) {
  fun color(argb: Int) = ColorProvider(Color(argb))

  companion object {
    fun forPeriod(period: String): AdhkarStyle =
      if (period == "morning") AdhkarStyle(
        0xFFF6EBD6.toInt(), 0xFF2A1D0C.toInt(), 0xFF5C4630.toInt(), 0xFFB4532A.toInt(), 0xFFFFFFFF.toInt(),
        0xFFD9C6A2.toInt(), R.drawable.widget_sun,
      ) else AdhkarStyle(
        0xFF141A36.toInt(), 0xFFEEF0FF.toInt(), 0xCCEEF0FF.toInt(), 0xFFC4B5FF.toInt(), 0xFF141A36.toInt(),
        0x38EEF0FF, R.drawable.widget_moon,
      )
  }
}

/** The period's sun or moon, tinted to its accent. */
@Composable
fun PeriodIcon(style: AdhkarStyle, sizeDp: Int) {
  Image(ImageProvider(style.symbol), contentDescription = null, colorFilter = ColorFilter.tint(style.color(style.accent)),
    modifier = GlanceModifier.size(sizeDp.dp))
}
// @ai-end

/**
 * Medium and large Adhkar: card through the session (spec 2026-10-12). Mirrors AdhkarSessionView.swift.
 * Buttons and the ring run actions; the caller's root click opens the adhkar screen at the current dhikr.
 * Medium has no progress bar and puts the "read the rest" hint in the controls row so the dhikr gets two lines.
 * The 110 dp medium (dense launchers, Bayaan Now) is shorter than iOS medium, so it tightens padding and gaps
 * and shows one line.
 */
@Composable
fun AdhkarSessionContent(context: Context, data: AdhkarPeriodData, session: AdhkarSession, large: Boolean, listening: Boolean = false) { // @ai
  val size = LocalSize.current
  val compact = !large && size.height < WidgetSizes.MEDIUM_TALL.height
  val pad = if (large) 16 else if (compact) 10 else 12
  val gap = if (large) 10 else if (compact) 4 else 6
  val item: SessionDhikr? = data.items.getOrNull(session.index)
  val style = AdhkarStyle.forPeriod(data.period) // @ai
  Column(GlanceModifier.fillMaxSize().background(style.color(style.background)).padding(pad.dp)) { // @ai
    // Gaps are paddings where possible: Glance renders at most 10 children per Column.
    Row(GlanceModifier.fillMaxWidth().padding(bottom = (if (compact) 4 else 6).dp), verticalAlignment = Alignment.CenterVertically) {
      // @ai-start
      PeriodIcon(style, 16)
      Spacer(GlanceModifier.width(6.dp))
      Text(data.title, maxLines = 1, modifier = GlanceModifier.defaultWeight(),
        style = TextStyle(color = style.color(style.primary), fontSize = 14.sp, fontWeight = FontWeight.Bold))
      if (!session.completed) {
        Text("${session.index + 1} of ${data.items.size}",
          style = TextStyle(color = style.color(style.secondary), fontSize = 12.sp, fontWeight = FontWeight.Bold))
      }
      // @ai-end
    }
    if (large) {
      LinearProgressIndicator(
        progress = if (session.completed) 1f else session.index.toFloat() / maxOf(1, data.items.size),
        modifier = GlanceModifier.fillMaxWidth().height(PROGRESS_DP.dp),
        color = style.color(style.accent), backgroundColor = style.color(style.track), // @ai
      )
    }
    Spacer(GlanceModifier.height(gap.dp))
    if (session.completed || item == null) {
      Completed(data, large, style) // @ai
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
      if (large) 22f else 18f, 11f, if (large) 9 else if (compact) 1 else 2, center = true, wholeLines = true,
      color = style.primary) // @ai
    if (translation != null) {
      Text(translation, maxLines = 3, modifier = GlanceModifier.padding(top = gap.dp), style = TextStyle(color = style.color(style.secondary), fontSize = 12.sp)) // @ai
    }
    if (cut) {
      Text(readTheRest(context), maxLines = 1, modifier = GlanceModifier.padding(top = gap.dp),
        style = TextStyle(color = style.color(style.secondary), fontSize = 11.sp, fontWeight = FontWeight.Medium)) // @ai
    }
    Spacer(GlanceModifier.defaultWeight())
    Row(GlanceModifier.fillMaxWidth().padding(top = gap.dp), verticalAlignment = Alignment.CenterVertically) {
      if (session.index > 0) StyledRound(style, R.drawable.widget_prev, "Previous", actionRunCallback<AdhkarPrevAction>()) // @ai
      // @ai-start
      // Plays the list's adhkar audio from the dhikr shown, even with the app closed; pauses while it plays.
      if (session.index > 0) Spacer(GlanceModifier.width(6.dp))
      StyledRound(style, if (listening) R.drawable.widget_pause else R.drawable.widget_play, if (listening) "Pause" else "Listen",
        adhkarListenAction(context, listening, data.superId, item.id))
      // @ai-end
      if (hint) {
        Text(READ_MORE, maxLines = 1, modifier = GlanceModifier.defaultWeight().padding(horizontal = 8.dp), // @ai
          style = TextStyle(color = style.color(style.secondary), fontSize = 10.sp, fontWeight = FontWeight.Medium)) // @ai
      } else {
        Spacer(GlanceModifier.defaultWeight())
      }
      // @ai-start
      CountPill(context, style, session.remaining, item.repeatCount)
      Spacer(GlanceModifier.width(8.dp))
      StyledRound(style, R.drawable.widget_next, "Next", actionRunCallback<AdhkarNextAction>())
      // @ai-end
    }
  }
}

private fun readTheRest(context: Context): String = "Read the rest in ${AppBrand.name(context)} →"

/** The controls row also holds Listen, so the hint there is shorter. */ // @ai
private const val READ_MORE = "Read more →" // @ai

// @ai-start
/** The accent "Count" pill with its repetition ring; a dhikr said once shows "Done". Tapping counts. */
@Composable
private fun CountPill(context: Context, style: AdhkarStyle, remaining: Int, total: Int) {
  val ringDp = 20
  val px = dpToPx(context, ringDp)
  val progress = if (total > 1) (total - remaining).toFloat() / total else 1f
  val trackArgb = (style.onAccent and 0x00FFFFFF) or 0x4D000000
  val bmp = remember(remaining, total, px, style.onAccent) { RingBitmap.render(px, px * 0.12f, progress, style.onAccent, trackArgb) }
  Row(
    GlanceModifier.height(CONTROLS_DP.dp).background(style.color(style.accent)).cornerRadius((CONTROLS_DP / 2).dp)
      .padding(start = 6.dp, end = 12.dp).clickable(actionRunCallback<AdhkarCountAction>()),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Image(ImageProvider(bmp), contentDescription = null, modifier = GlanceModifier.size(ringDp.dp))
    Spacer(GlanceModifier.width(6.dp))
    Text(if (total > 1) "Count · $remaining" else "Done", maxLines = 1,
      style = TextStyle(color = style.color(style.onAccent), fontSize = 12.sp, fontWeight = FontWeight.Bold))
  }
}

/** Outlined round button in the period's colors. */
@Composable
private fun StyledRound(style: AdhkarStyle, icon: Int, description: String, action: androidx.glance.action.Action) {
  Box(
    GlanceModifier.size(30.dp).background(style.color(style.track)).cornerRadius(15.dp).clickable(action),
    contentAlignment = Alignment.Center,
  ) {
    Image(ImageProvider(icon), contentDescription = description, colorFilter = ColorFilter.tint(style.color(style.primary)),
      modifier = GlanceModifier.size(18.dp))
  }
}
// @ai-end

@Composable
private fun ColumnScope.Completed(data: AdhkarPeriodData, large: Boolean, style: AdhkarStyle) { // @ai
  Column(GlanceModifier.fillMaxWidth().defaultWeight(), horizontalAlignment = Alignment.CenterHorizontally) {
    Spacer(GlanceModifier.defaultWeight())
    val check = if (large) 40 else 28
    Image(ImageProvider(R.drawable.widget_check_circle), contentDescription = null, colorFilter = ColorFilter.tint(style.color(style.accent)), // @ai
      modifier = GlanceModifier.size(check.dp))
    Spacer(GlanceModifier.height(8.dp))
    Text("${data.title} completed", maxLines = 1,
      style = TextStyle(color = style.color(style.primary), fontSize = 14.sp, fontWeight = FontWeight.Medium)) // @ai
    Spacer(GlanceModifier.height(8.dp))
    Box(
      GlanceModifier.background(style.color(style.accent)) // @ai.cornerRadius(14.dp).padding(horizontal = 12.dp, vertical = 6.dp)
        .clickable(actionRunCallback<AdhkarRestartAction>()),
      contentAlignment = Alignment.Center,
    ) {
      Text("Start again", style = TextStyle(color = style.color(style.onAccent), fontSize = 12.sp, fontWeight = FontWeight.Bold)) // @ai
    }
    Spacer(GlanceModifier.defaultWeight())
  }
}
