package expo.modules.bayaancar

import org.junit.Assert.assertEquals
import org.junit.Test

class CarRequestGateTest {
  @Test fun readyJsDeliversImmediately() {
    assertEquals(GateDecision.DELIVER, CarRequestGate.decide(jsReady = true, jsRuntimePresent = true, waitingSinceMs = null, nowMs = 0))
    assertEquals(GateDecision.DELIVER, CarRequestGate.decide(jsReady = true, jsRuntimePresent = true, waitingSinceMs = 0, nowMs = 60_000))
  }

  @Test fun notReadyWaitsThroughTheGracePeriod() {
    assertEquals(GateDecision.WAIT, CarRequestGate.decide(false, false, waitingSinceMs = 1_000, nowMs = 1_000))
    assertEquals(GateDecision.WAIT, CarRequestGate.decide(false, false, waitingSinceMs = 1_000, nowMs = 3_999))
    assertEquals(GateDecision.WAIT, CarRequestGate.decide(false, false, waitingSinceMs = null, nowMs = 99_000))
  }

  @Test fun notReadyFailsAfterTheGracePeriod() {
    assertEquals(GateDecision.FAIL, CarRequestGate.decide(false, false, waitingSinceMs = 1_000, nowMs = 4_000))
    assertEquals(GateDecision.FAIL, CarRequestGate.decide(false, false, waitingSinceMs = 1_000, nowMs = 600_000))
  }

  @Test fun bootingRuntimeGetsLongerGrace() {
    assertEquals(GateDecision.WAIT, CarRequestGate.decide(false, true, waitingSinceMs = 0, nowMs = 9_999))
    assertEquals(GateDecision.FAIL, CarRequestGate.decide(false, true, waitingSinceMs = 0, nowMs = 10_000))
  }

  @Test fun headlessCarRootGetsTheLongestGrace() {
    assertEquals(GateDecision.WAIT, CarRequestGate.decide(false, false, waitingSinceMs = 0, nowMs = 19_999, headlessBooting = true))
    assertEquals(GateDecision.WAIT, CarRequestGate.decide(false, true, waitingSinceMs = 0, nowMs = 15_000, headlessBooting = true))
    assertEquals(GateDecision.FAIL, CarRequestGate.decide(false, true, waitingSinceMs = 0, nowMs = 20_000, headlessBooting = true))
  }
}
