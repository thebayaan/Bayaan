// test/java/expo/modules/bayaanwidgets/WidgetDataTest.kt
package expo.modules.bayaanwidgets

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class WidgetDataTest {
  private fun fixture(name: String) = File("../src/__fixtures__/$name").readText()

  @Test fun decodesCatalogAndRejectsFutureVersion() {
    val c = CatalogModels.decode(fixture("catalog.json"))
    assertNotNull(c)
    assertEquals(2, c!!.reciters.size)
    assertEquals("Mishary Alafasi", c.reciter("r-alafasi")!!.name)
    assertNull(c.reciter("missing"))
    assertNull(c.reciter(null))
    assertNull(c.dhikr("33")!!.translation)
    assertEquals(100, c.dhikr("91")!!.repeatCount)
    assertNull(CatalogModels.decode(fixture("catalog.json").replace("\"version\": 1", "\"version\": 2")))
    assertNull(CatalogModels.decode("nope"))
  }

  @Test fun tasbeehDisplayFromSharedFixture() {
    val pending = TasbeehLogic.parse(fixture("tasbeeh.pending.json"))
    assertEquals(4, pending.size)
    assertEquals(2, TasbeehLogic.displayCount(WidgetTasbeehEntry(12, 100, "2026-10-10"), pending, "91", "2026-10-10"))
    assertEquals(4, TasbeehLogic.displayCount(WidgetTasbeehEntry(4, 100, "2026-10-10"), pending, "96", "2026-10-10"))
    assertEquals(0, TasbeehLogic.displayCount(WidgetTasbeehEntry(30, 33, "2026-10-09"), emptyList(), "x", "2026-10-10"))
    assertEquals(0, TasbeehLogic.displayCount(null, emptyList(), "x", "2026-10-10"))
    assertTrue(TasbeehLogic.parse("garbage").isEmpty())
  }

  @Test fun parsesGeneratedStaticData() {
    val surahs = StaticData.parseSurahs(File("src/main/assets/widgets/surahs.json").readText())
    val ayat = StaticData.parseAyat(File("src/main/assets/widgets/ayat.json").readText())
    assertEquals(114, surahs.size)
    assertEquals("surah-18.jpg", surahs[17].artworkFile)
    assertEquals(390, ayat.size)
    assertTrue(ayat.all { it.arabic.isNotEmpty() && it.translation.isNotEmpty() })
  }
}
