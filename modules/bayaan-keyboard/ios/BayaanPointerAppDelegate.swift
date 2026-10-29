import ExpoModulesCore
import React

/// Turns on W3C pointer events on iPad, so a trackpad or mouse hovering over
/// a view fires its `onPointerEnter` / `onPointerLeave` (ipad-standards §7.2).
/// It has to be set before React Native creates its root view, which happens
/// when the scene connects, after launch.
public class BayaanPointerAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if UIDevice.current.userInterfaceIdiom == .pad {
      RCTSetDispatchW3CPointerEvents(true)
    }
    return true
  }
}
