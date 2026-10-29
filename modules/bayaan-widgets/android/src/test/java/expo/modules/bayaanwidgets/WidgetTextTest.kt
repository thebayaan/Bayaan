package expo.modules.bayaanwidgets

import org.junit.Assert.assertEquals
import org.junit.Test

// @ai-start
class WidgetTextTest {
  @Test fun keepsNamesThatFit() {
    assertEquals("Mishary Alafasi", WidgetText.fitName("Mishary Alafasi", 15))
  }

  @Test fun dropsLeadingWordsBeforeLetters() {
    assertEquals("Alafasi", WidgetText.fitName("Mishary Alafasi", 12))
    assertEquals("Abdul Samad", WidgetText.fitName("Abdul Basit Abdul Samad", 12))
    assertEquals("Samad", WidgetText.fitName("Abdul Basit Abdul Samad", 6))
  }

  @Test fun keepsTheLastWordEvenWhenTooLong() {
    assertEquals("Alafasi", WidgetText.fitName("Mishary Alafasi", 3))
  }

  @Test fun shortensTitlesToTheirFirstWord() {
    assertEquals("Morning Adhkar", WidgetText.fitTitle("Morning Adhkar", 14))
    assertEquals("Morning", WidgetText.fitTitle("Morning Adhkar", 10))
  }

  @Test
  fun shortSurahNameDropsTheArticleOnlyWhenNeeded() {
    assertEquals("Hud", WidgetText.shortSurahName("Hud", 9))
    assertEquals("Baqarah", WidgetText.shortSurahName("Al-Baqarah", 9))
    assertEquals("Shu'ara", WidgetText.shortSurahName("Ash-Shu'ara", 9))
  }
}
// @ai-end
