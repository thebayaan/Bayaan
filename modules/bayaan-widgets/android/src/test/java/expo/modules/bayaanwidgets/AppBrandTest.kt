// test/java/expo/modules/bayaanwidgets/AppBrandTest.kt
package expo.modules.bayaanwidgets

import org.junit.Assert.assertEquals
import org.junit.Test

class AppBrandTest {
  @Test fun usesTheAppLabel() {
    assertEquals("Qariah", AppBrand.name(" Qariah "))
    assertEquals("Bayaan", AppBrand.name("Bayaan"))
  }

  @Test fun fallsBackWhenTheLabelIsBlank() {
    assertEquals("Bayaan", AppBrand.name(null))
    assertEquals("Bayaan", AppBrand.name("  "))
  }
}
