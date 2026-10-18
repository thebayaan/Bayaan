package expo.modules.bayaancar

/**
 * Which controllers may connect to the exported library service. Any installed
 * app can bind to it, so only cars, system-trusted controllers, this app, and
 * known media hosts get to browse history or send commands.
 */
object CarControllerPolicy {
  val knownMediaHosts: Set<String> = setOf(
    "com.google.android.projection.gearhead",
    "com.google.android.googlequicksearchbox",
    "com.google.android.wearable.app",
    "com.android.systemui",
    "com.google.android.carassistant",
  )

  fun isAllowed(
    controllerPackage: String,
    ownPackage: String,
    isCar: Boolean,
    isTrusted: Boolean,
  ): Boolean =
    isCar || isTrusted || controllerPackage == ownPackage || controllerPackage in knownMediaHosts
}
