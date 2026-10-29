// plugins/bayaan-car/SceneDelegate.swift
// Replaces the SDK template's ios/<app>/SceneDelegate.swift on every prebuild
// (plugins/withBayaanCar.js). It lives in the app target because it extends
// Expo's ExpoAppSceneDelegate, which the BayaanCar pod cannot import.
internal import Expo
internal import BayaanCar
import UIKit

/// The phone scene. Expo's `ExpoAppSceneDelegate` creates its own window and
/// starts React Native in it; here React Native may already be running in
/// the bridge's host window (CarPlay connected first), so only scene
/// connection is replaced. Everything else is inherited: warm deep links and
/// universal links reach React Native through the scene API, and life cycle
/// events and quick actions reach `ExpoAppDelegate` subscribers.
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    var extra: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      extra[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      extra[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    let bridge = BayaanCarSceneBridge.shared

    // iPad multi-window: React has one host window, so a second phone scene
    // cannot adopt it while the first is still connected. Refuse the new
    // session and hand its URL / activity to the running app instead.
    if let existingScene = bridge.hostWindow?.windowScene,
      existingScene !== windowScene,
      existingScene.activationState != .unattached
    {
      UIApplication.shared.requestSceneSessionDestruction(session, options: nil, errorHandler: nil)
      forwardConnectionEvents(connectionOptions, in: existingScene)
      return
    }

    let hostWindow = bridge.ensureStarted(extraLaunchOptions: extra)
    hostWindow.windowScene = windowScene
    hostWindow.frame = windowScene.coordinateSpace.bounds
    hostWindow.makeKeyAndVisible()
    window = hostWindow

    // A cold start reads its URL from the launch options above. When React
    // already booted from CarPlay, launch options were consumed, so this also
    // delivers the live event.
    forwardConnectionEvents(connectionOptions, in: windowScene)
  }

  @objc(windowScene:didUpdateCoordinateSpace:interfaceOrientation:traitCollection:)
  func windowScene(
    _ windowScene: UIWindowScene,
    didUpdate previousCoordinateSpace: UICoordinateSpace,
    interfaceOrientation previousInterfaceOrientation: UIInterfaceOrientation,
    traitCollection previousTraitCollection: UITraitCollection
  ) {
    guard let hostWindow = window, hostWindow.windowScene === windowScene else { return }
    hostWindow.frame = windowScene.coordinateSpace.bounds
  }

  /// Scene connections carry their URL, activity and quick action in the
  /// connection options instead of the usual callbacks.
  private func forwardConnectionEvents(_ connectionOptions: UIScene.ConnectionOptions, in scene: UIWindowScene) {
    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
    for activity in connectionOptions.userActivities {
      self.scene(scene, continue: activity)
    }
    if let shortcutItem = connectionOptions.shortcutItem {
      windowScene(scene, performActionFor: shortcutItem) { _ in }
    }
  }
}
