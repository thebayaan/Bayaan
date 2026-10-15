package expo.modules.bayaancar

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CarControllerPolicyTest {
  private val own = "org.example.fork"

  private fun allowed(pkg: String, isCar: Boolean = false, isTrusted: Boolean = false): Boolean =
    CarControllerPolicy.isAllowed(pkg, own, isCar, isTrusted)

  @Test fun carControllersAreAllowed() {
    assertTrue(allowed("com.some.headunit", isCar = true))
  }

  @Test fun trustedControllersAreAllowed() {
    assertTrue(allowed("com.oem.media", isTrusted = true))
  }

  @Test fun ownPackageIsAllowed() {
    assertTrue(allowed(own))
  }

  @Test fun knownMediaHostsAreAllowed() {
    listOf(
      "com.google.android.projection.gearhead",
      "com.google.android.googlequicksearchbox",
      "com.google.android.wearable.app",
      "com.android.systemui",
      "com.google.android.carassistant",
    ).forEach { assertTrue(it, allowed(it)) }
  }

  @Test fun otherAppsAreRejected() {
    listOf(
      "com.random.app",
      "com.google.android.projection.gearhead.evil",
      "org.example.fork.helper",
      "android.media.session.MediaController",
      "",
    ).forEach { assertFalse(it, allowed(it)) }
  }
}
