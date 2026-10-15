package expo.modules.bayaancar

import org.junit.Assert.assertEquals
import org.junit.Test

class CarBrandTest {
  @Test fun defaultsToBayaanBeforeInit() {
    assertEquals("Bayaan", CarBrand.name)
    assertEquals("Open Bayaan on your phone to get started", CarRequestGate.UNAVAILABLE_MESSAGE)
  }

  @Test fun messageUsesTheGivenName() {
    assertEquals("Open Qariah on your phone to get started", CarBrand.unavailableMessage("Qariah"))
  }
}
