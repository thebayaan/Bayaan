package expo.modules.bayaancar

enum class GateDecision { DELIVER, WAIT, FAIL }

/**
 * Decides what happens to a car play request or transport while JS may not be
 * ready. Android Auto can bind the library service with no Activity; the
 * service then starts a headless React root (CarReactRoot) that boots the
 * player and car bridge. A request waits while that boots, then fails with a
 * visible error instead of staying queued and playing minutes later.
 */
object CarRequestGate {
  /** No JS runtime at all: the phone app is not running. */
  const val GRACE_MS = 3_000L

  /** A JS runtime registered the module but has not marked ready: the app is booting. */
  const val BOOTING_GRACE_MS = 10_000L

  /** The headless car root is cold-booting JS (bundle load, catalogue, session restore). */
  const val HEADLESS_BOOT_GRACE_MS = 20_000L

  val UNAVAILABLE_MESSAGE: String get() = CarBrand.unavailableMessage()

  fun graceMs(jsRuntimePresent: Boolean, headlessBooting: Boolean = false): Long = when {
    headlessBooting -> HEADLESS_BOOT_GRACE_MS
    jsRuntimePresent -> BOOTING_GRACE_MS
    else -> GRACE_MS
  }

  /** [waitingSinceMs] is when the current queued request started waiting, or null if nothing waits. */
  fun decide(
    jsReady: Boolean,
    jsRuntimePresent: Boolean,
    waitingSinceMs: Long?,
    nowMs: Long,
    headlessBooting: Boolean = false,
  ): GateDecision = when {
    jsReady -> GateDecision.DELIVER
    waitingSinceMs == null -> GateDecision.WAIT
    nowMs - waitingSinceMs < graceMs(jsRuntimePresent, headlessBooting) -> GateDecision.WAIT
    else -> GateDecision.FAIL
  }
}
