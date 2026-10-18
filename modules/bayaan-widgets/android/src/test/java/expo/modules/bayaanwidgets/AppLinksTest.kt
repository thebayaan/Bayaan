// test/java/expo/modules/bayaanwidgets/AppLinksTest.kt
package expo.modules.bayaanwidgets

import org.junit.Assert.assertEquals
import org.junit.Test

class AppLinksTest {
  @Test fun usesTheGeneratedScheme() {
    assertEquals("bayaan://player", AppLinks.build("bayaan", "player"))
    assertEquals("qariah://quran/18?ayah=10", AppLinks.build("qariah", "quran/18?ayah=10"))
    assertEquals("my-app.v2://", AppLinks.build(" my-app.v2 ", ""))
  }

  @Test fun fallsBackWhenTheSchemeIsMissingOrInvalid() {
    assertEquals("bayaan://player", AppLinks.build(null, "player"))
    assertEquals("bayaan://player", AppLinks.build("", "player"))
    assertEquals("bayaan://player", AppLinks.build("1bad", "player"))
    assertEquals("bayaan://player", AppLinks.build("bad scheme", "player"))
  }
}
