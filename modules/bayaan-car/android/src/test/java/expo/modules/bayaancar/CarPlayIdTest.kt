package expo.modules.bayaancar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CarPlayIdTest {
  private val kahf = CarBrowseTree.surahRequest("r1", "hafs", 18)

  @Test fun roundTripsWithAndWithoutKey() {
    assertEquals(kahf, CarBrowseTree.requestFromPlayId(CarBrowseTree.playId(kahf)))
    assertEquals(kahf, CarBrowseTree.requestFromPlayId(CarBrowseTree.playId(kahf, "now:kahf")))
  }

  @Test fun sameRequestOnTwoCardsGetsTwoIds() {
    // Friday's Al-Kahf card and Al-Kahf in More from play the same request.
    assertNotEquals(CarBrowseTree.playId(kahf, "now:kahf"), CarBrowseTree.playId(kahf, "more:r1:18"))
  }

  @Test fun keepsTildesArabicAndSymbolsInTheRequest() {
    val json = """{"kind":"playlist","playlistId":"a~b ق/ر?x=1&y","system":false}"""
    assertEquals(json, CarBrowseTree.requestFromPlayId(CarBrowseTree.playId(json, "key~with~tildes")))
  }

  @Test fun rejectsOtherIds() {
    assertNull(CarBrowseTree.requestFromPlayId("tab:home"))
  }
}
