# CarPlay and Android Auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship CarPlay and Android Auto for Bayaan with a Spotify-style Home (situational shelves, recents, reciters, playlists), Library, Reciters and Surahs tabs, playing through the existing expo-audio player.

**Architecture:** A local Expo module `modules/bayaan-car` hosts a Swift CarPlay scene and a Kotlin Media3 `MediaLibraryService`. Both render from a JSON snapshot that a TypeScript service builds from existing stores. Taps in the car become play requests sent to JS, which resolves them to a queue and plays through `playerStore` / `ExpoAudioService`, exactly like the phone UI. A config plugin wires scenes, entitlements and the Android service so the change survives `expo prebuild --clean`.

**Tech Stack:** TypeScript (strict), Zustand stores, Jest (`jest-expo`), Expo Modules API (Swift, Kotlin), CarPlay framework (iOS 16.4 baseline, iOS 26/27 enhancements), AndroidX Media3 1.9.0 (`media3-session`), Expo config plugins.

**Spec:** `docs/superpowers/specs/2026-10-08-carplay-android-auto-design.md`

## Global Constraints

- Keep `expo-audio` as the only audio engine for recitations. No fork. A `patch-package` patch to expo-audio requires explicit sign-off from the project owner first.
- Base branch is `origin/develop` (Expo SDK 56, RN 0.85). PR targets `develop`.
- iOS deployment target stays 16.4. Every iOS 26 / 27 API is behind `if #available(iOS 26.0, *)` / `if #available(iOS 27.0, *)` with a working fallback.
- Media3 version must equal expo-audio's: `1.9.0` (from `node_modules/expo-audio/android/build.gradle`).
- All native project changes go through `plugins/withBayaanCar.js`; never hand-edit `ios/` or `android/` without the plugin producing the same result. Run `npx expo prebuild --clean` to confirm.
- TypeScript: strict, no `any`, no `as` casts unless unavoidable, explicit parameter and return types, `function` keyword for pure functions, early returns.
- No em dashes anywhere (code, comments, commits, copy).
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Before declaring any task done: `npx tsc --noEmit` and `npx prettier --write <changed files>` pass with zero errors.
- Fork safety (Qariah): no hard-coded `com.bayaan.app` in native code. Read bundle id / package at runtime.
- Car copy strings (English, v1): "Home", "Library", "Reciters", "Surahs", "Quick start", "For right now", "Jump back in", "Your reciters", "Your playlists", "Loved", "Playlists", "Downloads", "Favorite reciters", "Choose reciter", "Open Bayaan on your phone to get started", "Nothing here yet".

## Deviations from the spec (decided while planning)

1. **Top reciter** = the most recently played reciter in `recentlyPlayedStore` (non-upload), else `useReciterStore.getState().defaultReciter`. The spec said `playCountStore`, but that store counts per surah, not per reciter.
2. **Night rule** uses the existing `evening-serenity` system playlist (no "before sleep" playlist exists).
3. **Snapshot location** is the app's private storage (iOS Application Support, Android `filesDir`), not the App Group. Only the app process reads it; the App Group is unnecessary.
4. **iOS React start:** the AppDelegate no longer creates the window. A `BayaanCarSceneBridge` starts React Native into a host window on whichever scene connects first (phone or CarPlay). If CarPlay connects first, JS still boots, which is required because playback runs through JS.
5. **Item actions** are wrapped: `{kind: 'play', request}` or `{kind: 'browse', target}`.

Task 12 updates the spec to match.

## Review Focus

1. **Cold start from the car with the app killed:** first tap plays within a few seconds on both platforms; it must not silently drop the request. Pinned by Task 6 (`CarBridge` pending queue test) and manual checks in Tasks 1, 2, 9.
2. **Rewayah with gaps in `surah_list` (nulls, missing surahs):** Situational picks and play requests never target a surah the rewayah lacks. Pinned by tests in Tasks 3 and 4.
3. **Brand-new install (empty stores, no API reciters yet):** Home still renders (situational + system playlists), no crash, no blank tab. Pinned by Task 3 test "empty stores".
4. **User uploads in recents / loved / playlists:** they are skipped in v1 rather than producing broken items. Pinned by tests in Tasks 3 and 4.
5. **Phone and car control the same playback:** pausing on the phone updates the car and vice versa; no duplicate Android notification. Pinned by manual checks in Tasks 2, 8, 9.

---

## File Structure

```
modules/bayaan-car/
  expo-module.config.json
  index.ts                         JS API (typed wrapper, safe no-op when native missing)
  ios/
    BayaanCar.podspec
    BayaanCarModule.swift          Expo module: functions + events
    CarBridge.swift                singleton: snapshot store, pending requests, event sink
    CarSnapshot.swift              Codable snapshot types
    BayaanCarSceneBridge.swift     starts React into a host window once
    PhoneSceneDelegate.swift       phone window scene, URL forwarding
    CarPlaySceneDelegate.swift     CarPlay scene lifecycle
    CarTemplateBuilder.swift       snapshot -> CPTemplates
    CarNowPlaying.swift            CPNowPlayingTemplate buttons, next/prev commands, Up Next
    CarArtworkCache.swift          download, downscale, disk cache, placeholders
  android/
    build.gradle
    src/main/AndroidManifest.xml   service + provider declarations
    src/main/res/xml/automotive_app_desc.xml
    src/main/java/expo/modules/bayaancar/
      BayaanCarModule.kt
      CarBridge.kt
      CarSnapshot.kt
      BayaanLibraryService.kt
      CarForwardingPlayer.kt
      CarBrowseTree.kt
      CarSearch.kt
      CarArtworkProvider.kt
plugins/withBayaanCar.js           iOS scene manifest, entitlement, AppDelegate edit
services/car/
  types.ts                         CarSnapshot, CarItem, CarPlayRequest, CarNowPlaying, ...
  snapshot/situational.ts          buildSituationalPicks (pure)
  snapshot/buildCarSnapshot.ts     buildCarSnapshot (pure)
  snapshot/__tests__/situational.test.ts
  snapshot/__tests__/buildCarSnapshot.test.ts
  playback/resolveCarRequest.ts    CarPlayRequest -> CarQueuePlan (pure)
  playback/__tests__/resolveCarRequest.test.ts
  CarSnapshotService.ts            store subscriptions -> writeSnapshot
  CarPlaybackBridge.ts             native events -> playerStore; playerStore -> native now playing
  __tests__/CarPlaybackBridge.test.ts
  index.ts                         startCarIntegration()
services/audio/LockScreenService.ts   (modify) car mode: hide 10s skip while car connected
app.config.js                       (modify) register plugin
services/AppInitializer.ts          (modify) call startCarIntegration()
docs/features/carplay-android-auto.md (modify) point to spec
```

---

### Task 1: iOS scene migration and CarPlay hello (GATE)

Proves the riskiest iOS change. Code is kept if the gate passes.

**Files:**
- Create: `modules/bayaan-car/expo-module.config.json`, `modules/bayaan-car/index.ts`, `modules/bayaan-car/ios/BayaanCar.podspec`, `modules/bayaan-car/ios/BayaanCarModule.swift`, `modules/bayaan-car/ios/BayaanCarSceneBridge.swift`, `modules/bayaan-car/ios/PhoneSceneDelegate.swift`, `modules/bayaan-car/ios/CarPlaySceneDelegate.swift`
- Create: `plugins/withBayaanCar.js`
- Modify: `app.config.js` (plugins array, after `'./withIOSTeam.js'`)

**Interfaces:**
- Produces: `BayaanCarSceneBridge.shared.configure(start: (UIWindow, [UIApplication.LaunchOptionsKey: Any]) -> Void, onWindow: (UIWindow) -> Void)`, `BayaanCarSceneBridge.shared.ensureStarted(extraLaunchOptions:) -> UIWindow`; Info.plist scene classes `PhoneSceneDelegate`, `CarPlaySceneDelegate`.

- [ ] **Step 1: Create the module skeleton**

`modules/bayaan-car/expo-module.config.json`:
```json
{
  "platforms": ["apple", "android"],
  "apple": {"modules": ["BayaanCarModule"]},
  "android": {"modules": ["expo.modules.bayaancar.BayaanCarModule"]}
}
```

`modules/bayaan-car/ios/BayaanCar.podspec`:
```ruby
Pod::Spec.new do |s|
  s.name           = 'BayaanCar'
  s.version        = '1.0.0'
  s.summary        = 'CarPlay integration for Bayaan'
  s.author         = 'Bayaan'
  s.homepage       = 'https://thebayaan.com'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'CarPlay', 'MediaPlayer'
  s.source_files   = '**/*.swift'
end
```

`modules/bayaan-car/ios/BayaanCarModule.swift` (grows in Task 6):
```swift
import ExpoModulesCore

public class BayaanCarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BayaanCar")
  }
}
```

`modules/bayaan-car/index.ts` (grows in Task 6):
```ts
import {requireOptionalNativeModule} from 'expo-modules-core';

interface BayaanCarNative {
  readonly __brand?: 'BayaanCar';
}

export const BayaanCarNativeModule: BayaanCarNative | null =
  requireOptionalNativeModule<BayaanCarNative>('BayaanCar');
```

- [ ] **Step 2: Write `BayaanCarSceneBridge.swift`**

```swift
import UIKit

/// Starts React Native exactly once, into a host window that either the phone
/// scene adopts or that stays offscreen while only CarPlay is connected.
@objc public final class BayaanCarSceneBridge: NSObject {
  @objc public static let shared = BayaanCarSceneBridge()

  private var start: ((UIWindow, [UIApplication.LaunchOptionsKey: Any]) -> Void)?
  private var onWindow: ((UIWindow) -> Void)?
  public private(set) var hostWindow: UIWindow?

  public func configure(
    start: @escaping (UIWindow, [UIApplication.LaunchOptionsKey: Any]) -> Void,
    onWindow: @escaping (UIWindow) -> Void
  ) {
    self.start = start
    self.onWindow = onWindow
  }

  @discardableResult
  public func ensureStarted(
    extraLaunchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
  ) -> UIWindow {
    if let window = hostWindow { return window }
    let window = UIWindow(frame: UIScreen.main.bounds)
    hostWindow = window
    onWindow?(window)
    start?(window, extraLaunchOptions)
    return window
  }
}
```

- [ ] **Step 3: Write `PhoneSceneDelegate.swift`**

```swift
import UIKit

@objc(PhoneSceneDelegate)
public final class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
  public var window: UIWindow?

  public func scene(
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
    let alreadyStarted = bridge.hostWindow != nil
    let hostWindow = bridge.ensureStarted(extraLaunchOptions: extra)
    hostWindow.windowScene = windowScene
    hostWindow.frame = windowScene.coordinateSpace.bounds
    hostWindow.makeKeyAndVisible()
    window = hostWindow

    // React already booted from CarPlay: launch options were consumed, so
    // deliver the URL / activity as live events instead.
    guard alreadyStarted else { return }
    if let url = connectionOptions.urlContexts.first?.url {
      forward(url: url)
    }
    if let activity = connectionOptions.userActivities.first {
      forward(activity: activity)
    }
  }

  public func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      forward(url: context.url, sourceApplication: context.options.sourceApplication)
    }
  }

  public func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    forward(activity: userActivity)
  }

  private func forward(url: URL, sourceApplication: String? = nil) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let sourceApplication { options[.sourceApplication] = sourceApplication }
    _ = UIApplication.shared.delegate?.application?(UIApplication.shared, open: url, options: options)
  }

  private func forward(activity: NSUserActivity) {
    _ = UIApplication.shared.delegate?.application?(
      UIApplication.shared, continue: activity, restorationHandler: { _ in })
  }
}
```

- [ ] **Step 4: Write a hello `CarPlaySceneDelegate.swift`** (replaced in Task 7)

```swift
import CarPlay
import UIKit

@objc(CarPlaySceneDelegate)
public final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    BayaanCarSceneBridge.shared.ensureStarted()
    self.interfaceController = interfaceController
    let item = CPListItem(text: "Bayaan", detailText: "CarPlay is connected")
    let template = CPListTemplate(title: "Home", sections: [CPListSection(items: [item])])
    interfaceController.setRootTemplate(template, animated: false, completion: nil)
  }

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
  }
}
```

- [ ] **Step 5: Write the iOS half of `plugins/withBayaanCar.js`**

```js
const {
  withInfoPlist,
  withEntitlementsPlist,
  withAppDelegate,
  createRunOncePlugin,
} = require('expo/config-plugins');

const START_MARKER = '// @bayaan-car scene bridge start';
const END_MARKER = '// @bayaan-car scene bridge end';

const ORIGINAL_WINDOW_BLOCK = `    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)`;

const BRIDGE_BLOCK = `    ${START_MARKER}
    BayaanCarSceneBridge.shared.configure(
      start: { hostWindow, extra in
        let merged = (launchOptions ?? [:]).merging(extra) { _, new in new }
        factory.startReactNative(withModuleName: "main", in: hostWindow, launchOptions: merged)
      },
      onWindow: { [weak self] hostWindow in self?.window = hostWindow })
    ${END_MARKER}`;

function withCarPlayInfoPlist(config) {
  return withInfoPlist(config, cfg => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Phone',
            UISceneDelegateClassName: 'PhoneSceneDelegate',
          },
        ],
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'CarPlay',
            UISceneDelegateClassName: 'CarPlaySceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withCarPlayEntitlement(config) {
  return withEntitlementsPlist(config, cfg => {
    cfg.modResults['com.apple.developer.carplay-audio'] = true;
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, cfg => {
    let src = cfg.modResults.contents;
    if (src.includes(START_MARKER)) return cfg;
    if (!src.includes(ORIGINAL_WINDOW_BLOCK)) {
      throw new Error(
        '[withBayaanCar] AppDelegate window block not found. Update ORIGINAL_WINDOW_BLOCK for this Expo SDK.',
      );
    }
    src = src.replace(ORIGINAL_WINDOW_BLOCK, BRIDGE_BLOCK);
    if (!src.includes('import BayaanCar')) {
      src = src.replace('import React\n', 'import React\nimport BayaanCar\n');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withBayaanCar(config) {
  config = withCarPlayInfoPlist(config);
  config = withCarPlayEntitlement(config);
  config = withSceneAppDelegate(config);
  return config;
}

module.exports = createRunOncePlugin(withBayaanCar, 'withBayaanCar', '1.0.0');
```

Add `'./plugins/withBayaanCar.js',` to `app.config.js` plugins after `'./withIOSTeam.js',`.

- [ ] **Step 6: Prebuild and build**

Run: `npx expo prebuild --clean --platform ios && git diff --stat ios/`
Expected: `ios/Bayaan/Info.plist` gains `UIApplicationSceneManifest`; `Bayaan.entitlements` gains `com.apple.developer.carplay-audio`; `AppDelegate.swift` contains `@bayaan-car scene bridge start` and no longer creates `UIWindow(frame:` directly.

Build per memory note (Xcode 27): `xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' IPHONEOS_DEPLOYMENT_TARGET=16.4 build | tail -5`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 7: Gate checklist on the iOS Simulator (Debug with dev client, then Release)**

Each must pass. Record results in the PR description.
1. Cold launch shows splash then the app; dev-client launcher still works in Debug.
2. `xcrun simctl openurl booted "bayaan://reciter/<any-slug>"` with app killed opens the reciter screen (cold deep link).
3. Same URL with app running navigates (warm deep link).
4. Share an audio file from Files into Bayaan (share extension handoff) still opens the upload flow.
5. Tap a local notification (schedule one from the app's existing notification flow) opens the app.
6. Rotation lock still holds portrait (`expo-screen-orientation`).
7. Open the CarPlay Simulator (Device Hub > CarPlay). Bayaan appears; tapping it shows "CarPlay is connected".
8. Kill the app, open Bayaan from the CarPlay screen first, then open the phone app: the phone UI appears without a second JS boot (Metro logs one bundle load).

If item 1 fails only in Debug because dev-client bypass, or any of 2 to 8 fail and cannot be fixed within the bridge or `PhoneSceneDelegate`: STOP and report to the project owner before Task 3.

- [ ] **Step 8: Commit**

```bash
git add modules/bayaan-car plugins/withBayaanCar.js app.config.js ios
git commit -m "feat(carplay): scene-based iOS lifecycle and CarPlay scene"
```

---

### Task 2: Android library service hello (GATE)

Proves a second media session can serve Android Auto next to expo-audio's, and that the service can boot JS.

**Files:**
- Create: `modules/bayaan-car/android/build.gradle`, `modules/bayaan-car/android/src/main/AndroidManifest.xml`, `modules/bayaan-car/android/src/main/res/xml/automotive_app_desc.xml`, `modules/bayaan-car/android/src/main/java/expo/modules/bayaancar/BayaanCarModule.kt`, `.../BayaanLibraryService.kt`

**Interfaces:**
- Produces: service class `expo.modules.bayaancar.BayaanLibraryService`; Media3 session id `"bayaan-car"`.

- [ ] **Step 1: Gradle and manifest**

`modules/bayaan-car/android/build.gradle`:
```groovy
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'expo.modules.bayaancar'
version = '1.0.0'

android {
  namespace "expo.modules.bayaancar"
  defaultConfig {
    versionCode 1
    versionName "1.0.0"
  }
}

dependencies {
  def androidxMedia3Version = "1.9.0"
  implementation "androidx.media3:media3-session:$androidxMedia3Version"
  implementation "androidx.media3:media3-common:$androidxMedia3Version"
  implementation "com.google.guava:guava:33.3.1-android"
  implementation "androidx.concurrent:concurrent-futures:1.2.0"
}
```

`modules/bayaan-car/android/src/main/AndroidManifest.xml` (manifest merger adds it to the app; no prebuild edit needed):
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <meta-data
      android:name="com.google.android.gms.car.application"
      android:resource="@xml/automotive_app_desc" />
    <service
      android:name="expo.modules.bayaancar.BayaanLibraryService"
      android:exported="true"
      android:foregroundServiceType="mediaPlayback">
      <intent-filter>
        <action android:name="androidx.media3.session.MediaLibraryService" />
        <action android:name="android.media.browse.MediaBrowserService" />
      </intent-filter>
    </service>
  </application>
</manifest>
```

`automotive_app_desc.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
  <uses name="media" />
</automotiveApp>
```

- [ ] **Step 2: Module stub**

```kotlin
package expo.modules.bayaancar

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BayaanCarModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BayaanCar")
  }
}
```

- [ ] **Step 3: Hello `BayaanLibraryService.kt`** (replaced in Task 9)

```kotlin
package expo.modules.bayaancar

import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import com.facebook.react.ReactApplication
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

class BayaanLibraryService : MediaLibraryService() {
  private var session: MediaLibrarySession? = null

  override fun onCreate() {
    super.onCreate()
    val player = object : SimpleBasePlayer(mainLooper) {
      override fun getState(): State = State.Builder()
        .setAvailableCommands(Player.Commands.Builder().add(Player.COMMAND_PLAY_PAUSE).build())
        .build()
    }
    session = MediaLibrarySession.Builder(this, player, HelloCallback())
      .setId("bayaan-car")
      .build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = session

  // expo-audio's AudioControlsService owns the phone notification and the
  // foreground state. Ours must never post a second notification.
  override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) = Unit

  override fun onDestroy() {
    session?.run { player.release(); release() }
    session = null
    super.onDestroy()
  }

  private inner class HelloCallback : MediaLibrarySession.Callback {
    override fun onGetLibraryRoot(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<MediaItem>> {
      val root = MediaItem.Builder().setMediaId("root").setMediaMetadata(
        MediaMetadata.Builder().setIsBrowsable(true).setIsPlayable(false).build(),
      ).build()
      return Futures.immediateFuture(LibraryResult.ofItem(root, params))
    }

    override fun onGetChildren(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
      // Boot JS headlessly the first time the car browses.
      (application as? ReactApplication)?.reactHost?.start()
      val item = MediaItem.Builder().setMediaId("hello").setMediaMetadata(
        MediaMetadata.Builder().setTitle("Bayaan is connected").setIsBrowsable(false).setIsPlayable(true).build(),
      ).build()
      return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.of(item), params))
    }
  }
}
```

- [ ] **Step 4: Build and install**

Run: `npx expo prebuild --clean --platform android && cd android && ./gradlew :app:assembleDebug && cd ..`
Expected: `BUILD SUCCESSFUL`. `android/app/build/intermediates/merged_manifests` contains `BayaanLibraryService`.

- [ ] **Step 5: Gate checklist with the Desktop Head Unit**

Setup: enable Android Auto developer mode on the emulator/phone (tap version 10 times > "Start head unit server"), `adb forward tcp:5277 tcp:5277`, run `$ANDROID_HOME/extras/google/auto/desktop-head-unit`.
1. Bayaan appears in the DHU media apps; opening it shows "Bayaan is connected".
2. Play a surah from the phone UI: exactly one media notification on the phone (expo-audio's). `adb shell dumpsys notification | grep -c com.bayaan.app` shows one media notification entry.
3. Lock the phone with playback running for 5 minutes: audio continues.
4. Force-stop the app (`adb shell am force-stop <package>`), then open Bayaan from the DHU: `adb logcat | grep -i ReactNativeJS` shows the JS bundle starting without the activity.
5. Disconnect the DHU mid-playback: phone playback continues.

If 2, 3 or 4 fail and cannot be fixed inside our service: STOP and report to the project owner (fallback is the expo-audio patch, which needs sign-off).

- [ ] **Step 6: Commit**

```bash
git add modules/bayaan-car/android
git commit -m "feat(android-auto): Media3 library service alongside expo-audio"
```

---

### Task 3: Snapshot types, situational rules and snapshot builder

**Files:**
- Create: `services/car/types.ts`, `services/car/snapshot/situational.ts`, `services/car/snapshot/buildCarSnapshot.ts`
- Test: `services/car/snapshot/__tests__/situational.test.ts`, `services/car/snapshot/__tests__/buildCarSnapshot.test.ts`

**Interfaces:**
- Consumes: `Reciter` (`@/data/reciterData`), `Surah` (`@/data/surahData`), `RecentlyPlayedTrack`, `LovedTrack`, `DownloadedSurah`, `UserPlaylist`, `PlaylistItem` (`@/services/database/DatabaseService`), `SystemPlaylist` (`@/data/systemPlaylists`), `SURAH_TO_JUZ` (`@/data/juzData`).
- Produces: all types below; `buildSituationalPicks(ctx: SituationalContext): CarItem[]`; `buildCarSnapshot(input: CarSnapshotInput): CarSnapshot`; `pickTopReciter(input): TopReciter | null`; `availableSurahIds(rewayat: Rewayat | undefined): number[]`.

- [ ] **Step 1: Write `services/car/types.ts`**

```ts
export type CarArtwork =
  | {kind: 'surah'; surahId: number}
  | {kind: 'url'; url: string}
  | {kind: 'asset'; uri: string}
  | {kind: 'monogram'; label: string; hex: string}
  | {kind: 'color'; label: string; hex: string};

export type CarPlayRequest =
  | {
      kind: 'surah';
      reciterId: string;
      rewayatId: string;
      surahId: number;
      startAt?: number;
    }
  | {kind: 'playlist'; playlistId: string; system: boolean; startIndex?: number}
  | {kind: 'loved'; shuffle?: boolean; startIndex?: number}
  | {kind: 'downloads'; startIndex?: number}
  | {kind: 'resume'};

export type CarBrowseTarget =
  | {kind: 'list'; listId: string}
  | {kind: 'reciter'; reciterId: string}
  | {kind: 'surahReciters'; surahId: number};

export type CarItemAction =
  | {kind: 'play'; request: CarPlayRequest}
  | {kind: 'browse'; target: CarBrowseTarget};

export interface CarItem {
  id: string;
  title: string;
  subtitle?: string;
  artwork: CarArtwork;
  progress?: number;
  isDownloaded?: boolean;
  action: CarItemAction;
}

export type CarSectionStyle = 'rows' | 'cards' | 'circles';

export interface CarSection {
  id: string;
  title: string;
  style: CarSectionStyle;
  items: CarItem[];
}

export interface CarList {
  id: string;
  title: string;
  items: CarItem[];
}

export interface CarRewayah {
  id: string;
  name: string;
  style: string;
  surahIds: number[];
}

export interface CarReciter {
  id: string;
  name: string;
  artwork: CarArtwork;
  isFavorite: boolean;
  rewayat: CarRewayah[];
}

export interface CarSurah {
  id: number;
  name: string;
  nameArabic: string;
  translation: string;
  versesCount: number;
}

export interface CarSnapshot {
  version: 1;
  generatedAt: string;
  topReciterId: string | null;
  home: {quickStart: CarItem[]; sections: CarSection[]};
  library: CarItem[];
  lists: Record<string, CarList>;
  reciters: CarReciter[];
  surahs: CarSurah[];
  juz: {number: number; surahIds: number[]}[];
  downloadedKeys: string[];
}

export type CarTransport =
  | {kind: 'next'}
  | {kind: 'previous'}
  | {kind: 'play'}
  | {kind: 'pause'}
  | {kind: 'seek'; position: number}
  | {kind: 'rate'; value: number}
  | {kind: 'cycleRate'}
  | {kind: 'cycleRepeat'}
  | {kind: 'toggleLove'}
  | {kind: 'jumpTo'; index: number};

export interface CarNowPlaying {
  title: string;
  subtitle: string;
  reciterId: string | null;
  surahId: number | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
  repeatMode: 'none' | 'queue' | 'track';
  isLoved: boolean;
  artwork: CarArtwork | null;
  queue: {title: string; subtitle: string; surahId: number | null}[];
  currentIndex: number;
}

export function downloadKey(
  reciterId: string,
  rewayatId: string,
  surahId: number,
): string {
  return `${reciterId}:${rewayatId}:${surahId}`;
}
```

- [ ] **Step 2: Write the failing situational tests**

`services/car/snapshot/__tests__/situational.test.ts`:
```ts
import {buildSituationalPicks, SituationalContext} from '../situational';

const allSurahs = Array.from({length: 114}, (_, i) => i + 1);

function ctx(now: Date, overrides: Partial<SituationalContext> = {}): SituationalContext {
  return {
    now,
    topReciter: {
      reciterId: 'r1',
      rewayatId: 'rw1',
      name: 'Mishary Alafasy',
      surahIds: allSurahs,
    },
    lastPlayed: null,
    systemPlaylists: [
      {id: 'morning-reflections', title: 'Morning Reflections', color: '#F59E0B'},
      {id: 'evening-serenity', title: 'Evening Serenity', color: '#1E3A8A'},
    ],
    surahName: (id: number): string => `Surah ${id}`,
    ...overrides,
  };
}

// Months are 0-based. 2026-10-08 is a Thursday.
const thu1759 = new Date(2026, 9, 8, 17, 59);
const thu1800 = new Date(2026, 9, 8, 18, 0);
const fri1859 = new Date(2026, 9, 9, 18, 59);
const fri1900 = new Date(2026, 9, 9, 19, 0);
const sat0800 = new Date(2026, 9, 10, 8, 0);
const sat1400 = new Date(2026, 9, 10, 14, 0);
const sat2200 = new Date(2026, 9, 10, 22, 0);

describe('buildSituationalPicks', () => {
  it('offers Al-Kahf from Thursday 18:00', () => {
    const ids = buildSituationalPicks(ctx(thu1800)).map(p => p.id);
    expect(ids).toContain('now:kahf');
  });

  it('does not offer Al-Kahf on Thursday 17:59', () => {
    const ids = buildSituationalPicks(ctx(thu1759)).map(p => p.id);
    expect(ids).not.toContain('now:kahf');
  });

  it('offers Al-Kahf until Friday 18:59 and stops at 19:00', () => {
    expect(buildSituationalPicks(ctx(fri1859)).map(p => p.id)).toContain('now:kahf');
    expect(buildSituationalPicks(ctx(fri1900)).map(p => p.id)).not.toContain('now:kahf');
  });

  it('plays Al-Kahf with the top reciter', () => {
    const kahf = buildSituationalPicks(ctx(thu1800)).find(p => p.id === 'now:kahf');
    expect(kahf?.action).toEqual({
      kind: 'play',
      request: {kind: 'surah', reciterId: 'r1', rewayatId: 'rw1', surahId: 18},
    });
    expect(kahf?.subtitle).toBe('Mishary Alafasy');
    expect(kahf?.artwork).toEqual({kind: 'surah', surahId: 18});
  });

  it('skips Al-Kahf when the top rewayah lacks surah 18', () => {
    const c = ctx(thu1800, {
      topReciter: {reciterId: 'r1', rewayatId: 'rw1', name: 'X', surahIds: [1, 2, 3]},
    });
    expect(buildSituationalPicks(c).map(p => p.id)).not.toContain('now:kahf');
  });

  it('offers Morning Reflections in the morning', () => {
    const ids = buildSituationalPicks(ctx(sat0800)).map(p => p.id);
    expect(ids).toEqual(['now:morning']);
  });

  it('offers Al-Mulk and Evening Serenity at night', () => {
    const ids = buildSituationalPicks(ctx(sat2200)).map(p => p.id);
    expect(ids).toEqual(['now:mulk', 'now:evening']);
  });

  it('offers the next surah after a completed one', () => {
    const c = ctx(sat1400, {
      lastPlayed: {
        reciterId: 'r2',
        rewayatId: 'rw2',
        reciterName: 'Sudais',
        surahId: 2,
        completed: true,
        surahIds: [1, 2, 3],
      },
    });
    const next = buildSituationalPicks(c).find(p => p.id === 'now:upnext');
    expect(next?.action).toEqual({
      kind: 'play',
      request: {kind: 'surah', reciterId: 'r2', rewayatId: 'rw2', surahId: 3},
    });
    expect(next?.title).toBe('Up next: Surah 3');
  });

  it('skips up next when the last surah is the last available one', () => {
    const c = ctx(sat1400, {
      lastPlayed: {
        reciterId: 'r2', rewayatId: 'rw2', reciterName: 'S',
        surahId: 3, completed: true, surahIds: [1, 2, 3],
      },
    });
    expect(buildSituationalPicks(c)).toEqual([]);
  });

  it('skips up next when the last surah is not completed', () => {
    const c = ctx(sat1400, {
      lastPlayed: {
        reciterId: 'r2', rewayatId: 'rw2', reciterName: 'S',
        surahId: 2, completed: false, surahIds: [1, 2, 3],
      },
    });
    expect(buildSituationalPicks(c)).toEqual([]);
  });

  it('returns nothing reciter-based without a top reciter', () => {
    const ids = buildSituationalPicks(ctx(sat2200, {topReciter: null})).map(p => p.id);
    expect(ids).toEqual(['now:evening']);
  });

  it('caps at 4 picks', () => {
    // Friday 03:00 is Friday window + night.
    const c = ctx(new Date(2026, 9, 9, 3, 0), {
      lastPlayed: {
        reciterId: 'r2', rewayatId: 'rw2', reciterName: 'S',
        surahId: 2, completed: true, surahIds: [1, 2, 3],
      },
    });
    expect(buildSituationalPicks(c).length).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest services/car/snapshot/__tests__/situational.test.ts --watchAll=false`
Expected: FAIL, `Cannot find module '../situational'`.

- [ ] **Step 4: Implement `services/car/snapshot/situational.ts`**

```ts
import {CarItem} from '@/services/car/types';

export interface SituationalReciter {
  reciterId: string;
  rewayatId: string;
  name: string;
  surahIds: number[];
}

export interface SituationalLastPlayed {
  reciterId: string;
  rewayatId: string;
  reciterName: string;
  surahId: number;
  completed: boolean;
  surahIds: number[];
}

export interface SituationalPlaylist {
  id: string;
  title: string;
  color: string;
}

export interface SituationalContext {
  now: Date;
  topReciter: SituationalReciter | null;
  lastPlayed: SituationalLastPlayed | null;
  systemPlaylists: SituationalPlaylist[];
  surahName: (surahId: number) => string;
}

const MAX_PICKS = 4;
const KAHF = 18;
const MULK = 67;

function isFridayWindow(now: Date): boolean {
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 4) return hour >= 18;
  if (day === 5) return hour < 19;
  return false;
}

function isMorning(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 4 && hour < 11;
}

function isNight(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 21 || hour < 4;
}

function surahPick(
  id: string,
  reciter: SituationalReciter,
  surahId: number,
  title: string,
): CarItem | null {
  if (!reciter.surahIds.includes(surahId)) return null;
  return {
    id,
    title,
    subtitle: reciter.name,
    artwork: {kind: 'surah', surahId},
    action: {
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: reciter.reciterId,
        rewayatId: reciter.rewayatId,
        surahId,
      },
    },
  };
}

function playlistPick(
  id: string,
  playlists: SituationalPlaylist[],
  playlistId: string,
): CarItem | null {
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return null;
  return {
    id,
    title: playlist.title,
    artwork: {kind: 'color', label: playlist.title, hex: playlist.color},
    action: {
      kind: 'play',
      request: {kind: 'playlist', playlistId, system: true},
    },
  };
}

function upNextPick(ctx: SituationalContext): CarItem | null {
  const last = ctx.lastPlayed;
  if (!last || !last.completed) return null;
  const sorted = [...last.surahIds].sort((a, b) => a - b);
  const next = sorted.find(id => id > last.surahId);
  if (next === undefined) return null;
  return {
    id: 'now:upnext',
    title: `Up next: ${ctx.surahName(next)}`,
    subtitle: last.reciterName,
    artwork: {kind: 'surah', surahId: next},
    action: {
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: last.reciterId,
        rewayatId: last.rewayatId,
        surahId: next,
      },
    },
  };
}

export function buildSituationalPicks(ctx: SituationalContext): CarItem[] {
  const candidates: (CarItem | null)[] = [];
  const reciter = ctx.topReciter;

  if (isFridayWindow(ctx.now) && reciter) {
    candidates.push(surahPick('now:kahf', reciter, KAHF, `Friday: ${ctx.surahName(KAHF)}`));
  }
  if (isMorning(ctx.now)) {
    candidates.push(playlistPick('now:morning', ctx.systemPlaylists, 'morning-reflections'));
  }
  if (isNight(ctx.now)) {
    if (reciter) {
      candidates.push(surahPick('now:mulk', reciter, MULK, `Before sleep: ${ctx.surahName(MULK)}`));
    }
    candidates.push(playlistPick('now:evening', ctx.systemPlaylists, 'evening-serenity'));
  }
  candidates.push(upNextPick(ctx));

  const seen = new Set<string>();
  const picks: CarItem[] = [];
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    picks.push(candidate);
    if (picks.length === MAX_PICKS) break;
  }
  return picks;
}
```

- [ ] **Step 5: Run situational tests**

Run: `npx jest services/car/snapshot/__tests__/situational.test.ts --watchAll=false`
Expected: PASS (12 tests).

- [ ] **Step 6: Write the failing snapshot builder tests**

`services/car/snapshot/__tests__/buildCarSnapshot.test.ts`:
```ts
import {buildCarSnapshot, CarSnapshotInput, availableSurahIds} from '../buildCarSnapshot';
import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';

function rewayat(id: string, reciterId: string, list: (number | null)[]): Rewayat {
  return {
    id, reciter_id: reciterId, name: "Hafs A'n Assem", style: 'murattal',
    server: 'https://cdn.example.com', surah_total: list.length, surah_list: list,
    source_type: 'r2', created_at: '2026-01-01',
  };
}

function reciter(id: string, name: string, list: (number | null)[]): Reciter {
  return {id, name, date: null, image_url: null, rewayat: [rewayat(`${id}-hafs`, id, list)]};
}

function surah(id: number): Surah {
  return {
    id, name: `Surah ${id}`, revelation_place: 'Makkah', revelation_order: id,
    bismillah_pre: true, name_arabic: `س${id}`, verses_count: 10, pages: '1',
    translated_name_english: `T${id}`,
  };
}

const surahs = Array.from({length: 114}, (_, i) => surah(i + 1));
const mishary = reciter('r1', 'Mishary', surahs.map(s => s.id));
const sudais = reciter('r2', 'Sudais', [1, 2, null, 18]);

function recent(r: Reciter, s: number, progress: number): RecentlyPlayedTrack {
  return {
    reciter: r, surah: surah(s), rewayatId: r.rewayat[0].id,
    progress, duration: 600, timestamp: 1,
  };
}

function input(overrides: Partial<CarSnapshotInput> = {}): CarSnapshotInput {
  return {
    now: new Date(2026, 9, 10, 14, 0), // Saturday afternoon: no time rules
    reciters: [mishary, sudais],
    surahs,
    favoriteReciterIds: [],
    defaultReciterId: 'r1',
    recentTracks: [],
    lovedTracks: [],
    downloads: [],
    userPlaylists: [],
    playlistItems: {},
    systemPlaylists: [],
    surahToJuz: {1: 1, 2: 1, 18: 15},
    resolveReciterArtwork: (r: Reciter) => ({kind: 'monogram', label: r.name.slice(0, 1), hex: '#333333'}),
    ...overrides,
  };
}

describe('availableSurahIds', () => {
  it('drops nulls and sorts', () => {
    expect(availableSurahIds(sudais.rewayat[0])).toEqual([1, 2, 18]);
  });
  it('returns all 114 when the list is empty', () => {
    expect(availableSurahIds(rewayat('x', 'y', [])).length).toBe(114);
  });
});

describe('buildCarSnapshot', () => {
  it('handles empty stores without throwing and keeps Home non-empty when system playlists exist', () => {
    const snap = buildCarSnapshot(input({
      systemPlaylists: [{
        id: 'juz-amma', title: 'Juz Amma', description: '', backgroundColor: '#123456',
        type: 'surah-only', items: [{surahId: 78}], heightMultiplier: 1, column: 'left', order: 1,
      }],
    }));
    expect(snap.version).toBe(1);
    expect(snap.home.quickStart).toEqual([]);
    expect(snap.home.sections.map(s => s.id)).toEqual(['your-playlists']);
    expect(snap.library.map(i => i.id)).toEqual(['lib:loved', 'lib:playlists', 'lib:downloads', 'lib:favorite-reciters']);
  });

  it('uses the most recent reciter as top reciter, else the default', () => {
    expect(buildCarSnapshot(input()).topReciterId).toBe('r1');
    expect(buildCarSnapshot(input({recentTracks: [recent(sudais, 2, 0.5)]})).topReciterId).toBe('r2');
  });

  it('builds Jump back in with fractional progress and a resume start position', () => {
    const snap = buildCarSnapshot(input({recentTracks: [recent(sudais, 2, 0.5)]}));
    const section = snap.home.sections.find(s => s.id === 'jump-back-in');
    expect(section?.items[0].progress).toBe(0.5);
    expect(section?.items[0].action).toEqual({
      kind: 'play',
      request: {kind: 'surah', reciterId: 'r2', rewayatId: 'r2-hafs', surahId: 2, startAt: 300},
    });
  });

  it('skips user uploads in recents', () => {
    const upload: RecentlyPlayedTrack = {...recent(sudais, 2, 0.5), isUserUpload: true};
    const snap = buildCarSnapshot(input({recentTracks: [upload]}));
    expect(snap.home.sections.find(s => s.id === 'jump-back-in')).toBeUndefined();
    expect(snap.home.quickStart.find(i => i.id === 'quick:resume')).toBeUndefined();
  });

  it('puts Resume and Shuffle Loved in quick start when available', () => {
    const snap = buildCarSnapshot(input({
      recentTracks: [recent(mishary, 1, 0.1)],
      lovedTracks: [{reciterId: 'r1', surahId: '1', rewayatId: 'r1-hafs', timestamp: 1}],
    }));
    expect(snap.home.quickStart.map(i => i.id).slice(0, 2)).toEqual(['quick:resume', 'quick:shuffle-loved']);
  });

  it('orders favorites first in reciters and marks them', () => {
    const snap = buildCarSnapshot(input({favoriteReciterIds: ['r2']}));
    expect(snap.reciters.map(r => r.id)).toEqual(['r2', 'r1']);
    expect(snap.reciters[0].isFavorite).toBe(true);
    expect(snap.reciters[0].rewayat[0].surahIds).toEqual([1, 2, 18]);
  });

  it('lists only completed downloads and records their keys', () => {
    const snap = buildCarSnapshot(input({
      downloads: [
        {reciterId: 'r1', surahId: '1', rewayatId: 'r1-hafs', filePath: 'a', fileSize: 1, downloadDate: 1, status: 'completed'},
        {reciterId: 'r1', surahId: '2', rewayatId: 'r1-hafs', filePath: 'b', fileSize: 1, downloadDate: 1, status: 'downloading'},
      ],
    }));
    expect(snap.lists.downloads.items.length).toBe(1);
    expect(snap.downloadedKeys).toEqual(['r1:r1-hafs:1']);
  });

  it('skips loved items whose reciter is unknown', () => {
    const snap = buildCarSnapshot(input({
      lovedTracks: [{reciterId: 'gone', surahId: '1', rewayatId: 'x', timestamp: 1}],
    }));
    expect(snap.lists.loved.items).toEqual([]);
  });

  it('groups surahs by starting juz', () => {
    const snap = buildCarSnapshot(input());
    expect(snap.juz.find(j => j.number === 1)?.surahIds).toEqual([1, 2]);
  });
});
```

- [ ] **Step 7: Run to verify failure**

Run: `npx jest services/car/snapshot/__tests__/buildCarSnapshot.test.ts --watchAll=false`
Expected: FAIL, `Cannot find module '../buildCarSnapshot'`.

- [ ] **Step 8: Implement `services/car/snapshot/buildCarSnapshot.ts`**

```ts
import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {SystemPlaylist} from '@/data/systemPlaylists';
import {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {LovedTrack} from '@/services/player/store/lovedStore';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {UserPlaylist, PlaylistItem} from '@/services/database/DatabaseService';
import {
  CarArtwork,
  CarItem,
  CarList,
  CarReciter,
  CarSection,
  CarSnapshot,
  downloadKey,
} from '@/services/car/types';
import {buildSituationalPicks, SituationalReciter} from './situational';

export interface CarSnapshotInput {
  now: Date;
  reciters: Reciter[];
  surahs: Surah[];
  favoriteReciterIds: string[];
  defaultReciterId: string | null;
  recentTracks: RecentlyPlayedTrack[];
  lovedTracks: LovedTrack[];
  downloads: DownloadedSurah[];
  userPlaylists: UserPlaylist[];
  playlistItems: Record<string, PlaylistItem[]>;
  systemPlaylists: SystemPlaylist[];
  surahToJuz: Record<number, number>;
  resolveReciterArtwork: (reciter: Reciter) => CarArtwork;
}

const ALL_SURAH_IDS = Array.from({length: 114}, (_, i) => i + 1);
const JUMP_BACK_IN_LIMIT = 10;
const QUICK_START_LIMIT = 4;

export function availableSurahIds(rewayat: Rewayat | undefined): number[] {
  if (!rewayat || rewayat.surah_list.length === 0) return ALL_SURAH_IDS;
  return rewayat.surah_list
    .filter((id): id is number => id !== null)
    .sort((a, b) => a - b);
}

function findRewayat(reciter: Reciter, rewayatId: string | undefined): Rewayat | undefined {
  return reciter.rewayat.find(r => r.id === rewayatId) ?? reciter.rewayat[0];
}

function pickTopReciter(input: CarSnapshotInput): SituationalReciter | null {
  const recent = input.recentTracks.find(t => !t.isUserUpload);
  const candidates: {reciter: Reciter | undefined; rewayatId: string | undefined}[] = [
    {
      reciter: recent ? input.reciters.find(r => r.id === recent.reciter.id) : undefined,
      rewayatId: recent?.rewayatId,
    },
    {reciter: input.reciters.find(r => r.id === input.defaultReciterId), rewayatId: undefined},
  ];
  for (const candidate of candidates) {
    if (!candidate.reciter) continue;
    const rewayat = findRewayat(candidate.reciter, candidate.rewayatId);
    if (!rewayat) continue;
    return {
      reciterId: candidate.reciter.id,
      rewayatId: rewayat.id,
      name: candidate.reciter.name,
      surahIds: availableSurahIds(rewayat),
    };
  }
  return null;
}

function surahItem(
  id: string,
  reciter: Reciter,
  rewayatId: string,
  surah: Surah,
  extra: Partial<CarItem>,
  request: CarItem['action'],
): CarItem {
  return {
    id,
    title: surah.name,
    subtitle: reciter.name,
    artwork: {kind: 'surah', surahId: surah.id},
    ...extra,
    action: request,
  };
}

function buildJumpBackIn(input: CarSnapshotInput): CarItem[] {
  return input.recentTracks
    .filter(t => !t.isUserUpload)
    .slice(0, JUMP_BACK_IN_LIMIT)
    .map(t => {
      const rewayatId = t.rewayatId || t.reciter.rewayat[0]?.id || '';
      return surahItem(
        `recent:${t.reciter.id}:${rewayatId}:${t.surah.id}`,
        t.reciter,
        rewayatId,
        t.surah,
        {progress: t.progress},
        {
          kind: 'play',
          request: {
            kind: 'surah',
            reciterId: t.reciter.id,
            rewayatId,
            surahId: t.surah.id,
            startAt: t.progress * t.duration,
          },
        },
      );
    });
}

function buildLovedList(input: CarSnapshotInput): CarList {
  const sorted = [...input.lovedTracks]
    .filter(t => !t.userRecitationId)
    .sort((a, b) => b.timestamp - a.timestamp);
  const items: CarItem[] = [];
  sorted.forEach(t => {
    const reciter = input.reciters.find(r => r.id === t.reciterId);
    const surah = input.surahs.find(s => s.id === Number(t.surahId));
    if (!reciter || !surah) return;
    items.push(
      surahItem(`loved:${t.reciterId}:${t.rewayatId}:${t.surahId}`, reciter, t.rewayatId, surah, {}, {
        kind: 'play',
        request: {kind: 'loved', startIndex: items.length},
      }),
    );
  });
  return {id: 'loved', title: 'Loved', items};
}

function buildDownloadsList(input: CarSnapshotInput): CarList {
  const items: CarItem[] = [];
  input.downloads
    .filter(d => d.status === 'completed')
    .forEach(d => {
      const reciter = input.reciters.find(r => r.id === d.reciterId);
      const surah = input.surahs.find(s => s.id === Number(d.surahId));
      if (!reciter || !surah) return;
      items.push(
        surahItem(`download:${d.reciterId}:${d.rewayatId}:${d.surahId}`, reciter, d.rewayatId, surah, {isDownloaded: true}, {
          kind: 'play',
          request: {kind: 'downloads', startIndex: items.length},
        }),
      );
    });
  return {id: 'downloads', title: 'Downloads', items};
}

function playlistEntries(input: CarSnapshotInput): CarItem[] {
  const user: CarItem[] = input.userPlaylists.map(p => ({
    id: `playlist:${p.id}`,
    title: p.name,
    subtitle: `${p.itemCount} surahs`,
    artwork: {kind: 'color', label: p.name, hex: p.color},
    action: {kind: 'browse', target: {kind: 'list', listId: `playlist:${p.id}`}},
  }));
  const system: CarItem[] = [...input.systemPlaylists]
    .sort((a, b) => a.order - b.order)
    .map(p => ({
      id: `system:${p.id}`,
      title: p.title,
      subtitle: p.subtitle,
      artwork: {kind: 'color', label: p.title, hex: p.backgroundColor},
      action: {kind: 'browse', target: {kind: 'list', listId: `system:${p.id}`}},
    }));
  return [...user, ...system];
}

function playlistLists(input: CarSnapshotInput, top: SituationalReciter | null): CarList[] {
  const lists: CarList[] = [];
  input.userPlaylists.forEach(p => {
    const items: CarItem[] = [];
    [...(input.playlistItems[p.id] ?? [])]
      .filter(i => !i.userRecitationId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach(i => {
        const reciter = input.reciters.find(r => r.id === i.reciterId);
        const surah = input.surahs.find(s => s.id === Number(i.surahId));
        if (!reciter || !surah) return;
        const rewayatId = i.rewayatId ?? reciter.rewayat[0]?.id ?? '';
        items.push(
          surahItem(`pl:${p.id}:${i.id}`, reciter, rewayatId, surah, {}, {
            kind: 'play',
            request: {kind: 'playlist', playlistId: p.id, system: false, startIndex: items.length},
          }),
        );
      });
    lists.push({id: `playlist:${p.id}`, title: p.name, items});
  });
  input.systemPlaylists.forEach(p => {
    const items: CarItem[] = [];
    p.items.forEach(i => {
      const reciterId = i.reciterId ?? top?.reciterId;
      const reciter = input.reciters.find(r => r.id === reciterId);
      const surah = input.surahs.find(s => s.id === i.surahId);
      if (!reciter || !surah) return;
      const rewayatId = i.rewayatId ?? findRewayat(reciter, top?.rewayatId)?.id ?? '';
      items.push(
        surahItem(`sys:${p.id}:${i.surahId}`, reciter, rewayatId, surah, {}, {
          kind: 'play',
          request: {kind: 'playlist', playlistId: p.id, system: true, startIndex: items.length},
        }),
      );
    });
    lists.push({id: `system:${p.id}`, title: p.title, items});
  });
  return lists;
}

function reciterEntry(reciter: Reciter, input: CarSnapshotInput, isFavorite: boolean): CarReciter {
  return {
    id: reciter.id,
    name: reciter.name,
    artwork: input.resolveReciterArtwork(reciter),
    isFavorite,
    rewayat: reciter.rewayat.map(r => ({
      id: r.id,
      name: r.name,
      style: r.style,
      surahIds: availableSurahIds(r),
    })),
  };
}

function reciterBrowseItem(reciter: CarReciter): CarItem {
  return {
    id: `reciter:${reciter.id}`,
    title: reciter.name,
    artwork: reciter.artwork,
    action: {kind: 'browse', target: {kind: 'reciter', reciterId: reciter.id}},
  };
}

export function buildCarSnapshot(input: CarSnapshotInput): CarSnapshot {
  const top = pickTopReciter(input);
  const favorites = new Set(input.favoriteReciterIds);

  const reciters: CarReciter[] = [
    ...input.reciters.filter(r => favorites.has(r.id)).map(r => reciterEntry(r, input, true)),
    ...input.reciters
      .filter(r => !favorites.has(r.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(r => reciterEntry(r, input, false)),
  ];
  const favoriteReciters = reciters.filter(r => r.isFavorite).map(reciterBrowseItem);

  const lastRecent = input.recentTracks.find(t => !t.isUserUpload);
  const lastRewayat = lastRecent ? findRewayat(lastRecent.reciter, lastRecent.rewayatId) : undefined;
  const situational = buildSituationalPicks({
    now: input.now,
    topReciter: top,
    lastPlayed:
      lastRecent && lastRewayat
        ? {
            reciterId: lastRecent.reciter.id,
            rewayatId: lastRewayat.id,
            reciterName: lastRecent.reciter.name,
            surahId: lastRecent.surah.id,
            completed: lastRecent.progress >= 0.95,
            surahIds: availableSurahIds(lastRewayat),
          }
        : null,
    systemPlaylists: input.systemPlaylists.map(p => ({id: p.id, title: p.title, color: p.backgroundColor})),
    surahName: (id: number): string => input.surahs.find(s => s.id === id)?.name ?? `Surah ${id}`,
  });

  const jumpBackIn = buildJumpBackIn(input);
  const loved = buildLovedList(input);
  const downloads = buildDownloadsList(input);
  const playlists = playlistEntries(input);

  const quickStart: CarItem[] = [];
  if (jumpBackIn.length > 0) {
    quickStart.push({
      id: 'quick:resume',
      title: 'Resume',
      subtitle: jumpBackIn[0].title,
      artwork: jumpBackIn[0].artwork,
      action: {kind: 'play', request: {kind: 'resume'}},
    });
  }
  if (loved.items.length > 0) {
    quickStart.push({
      id: 'quick:shuffle-loved',
      title: 'Shuffle Loved',
      artwork: {kind: 'color', label: 'Loved', hex: '#BE123C'},
      action: {kind: 'play', request: {kind: 'loved', shuffle: true}},
    });
  }
  situational.forEach(item => {
    if (quickStart.length < QUICK_START_LIMIT) quickStart.push(item);
  });

  const sections: CarSection[] = [
    {id: 'for-now', title: 'For right now', style: 'cards', items: situational},
    {id: 'jump-back-in', title: 'Jump back in', style: 'rows', items: jumpBackIn},
    {id: 'your-reciters', title: 'Your reciters', style: 'circles', items: favoriteReciters},
    {id: 'your-playlists', title: 'Your playlists', style: 'rows', items: playlists},
  ].filter(section => section.items.length > 0);

  const lists: Record<string, CarList> = {
    loved,
    downloads,
    playlists: {id: 'playlists', title: 'Playlists', items: playlists},
    'favorite-reciters': {id: 'favorite-reciters', title: 'Favorite reciters', items: favoriteReciters},
  };
  playlistLists(input, top).forEach(list => {
    lists[list.id] = list;
  });

  const library: CarItem[] = [
    {id: 'lib:loved', title: 'Loved', artwork: {kind: 'color', label: 'Loved', hex: '#BE123C'}, action: {kind: 'browse', target: {kind: 'list', listId: 'loved'}}},
    {id: 'lib:playlists', title: 'Playlists', artwork: {kind: 'color', label: 'Playlists', hex: '#0F766E'}, action: {kind: 'browse', target: {kind: 'list', listId: 'playlists'}}},
    {id: 'lib:downloads', title: 'Downloads', artwork: {kind: 'color', label: 'Downloads', hex: '#1D4ED8'}, action: {kind: 'browse', target: {kind: 'list', listId: 'downloads'}}},
    {id: 'lib:favorite-reciters', title: 'Favorite reciters', artwork: {kind: 'color', label: 'Reciters', hex: '#7C3AED'}, action: {kind: 'browse', target: {kind: 'list', listId: 'favorite-reciters'}}},
  ];

  const juzMap = new Map<number, number[]>();
  input.surahs.forEach(s => {
    const juz = input.surahToJuz[s.id];
    if (juz === undefined) return;
    juzMap.set(juz, [...(juzMap.get(juz) ?? []), s.id]);
  });

  return {
    version: 1,
    generatedAt: input.now.toISOString(),
    topReciterId: top?.reciterId ?? null,
    home: {quickStart, sections},
    library,
    lists,
    reciters,
    surahs: input.surahs.map(s => ({
      id: s.id,
      name: s.name,
      nameArabic: s.name_arabic,
      translation: s.translated_name_english,
      versesCount: s.verses_count,
    })),
    juz: [...juzMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, surahIds]) => ({number, surahIds})),
    downloadedKeys: input.downloads
      .filter(d => d.status === 'completed')
      .map(d => downloadKey(d.reciterId, d.rewayatId, Number(d.surahId))),
  };
}
```

Note: `SystemPlaylist` must be exported from `data/systemPlaylists.ts` (it is: `export interface SystemPlaylist`). `pickTopReciter` stays module-private; tests exercise it through `topReciterId`.

- [ ] **Step 9: Run all car snapshot tests**

Run: `npx jest services/car/snapshot --watchAll=false`
Expected: PASS.

- [ ] **Step 10: Typecheck, format, commit**

```bash
npx tsc --noEmit
npx prettier --write services/car
git add services/car
git commit -m "feat(car): snapshot model and situational shelves"
```

---

### Task 4: Play request resolver

**Files:**
- Create: `services/car/playback/resolveCarRequest.ts`
- Test: `services/car/playback/__tests__/resolveCarRequest.test.ts`

**Interfaces:**
- Consumes: `CarPlayRequest` (Task 3), `availableSurahIds` (Task 3).
- Produces:
```ts
export interface CarTrackSpec {reciterId: string; rewayatId: string; surahId: number}
export interface CarQueuePlan {tracks: CarTrackSpec[]; startIndex: number; startPosition: number; shuffle: boolean; chain: 'new' | 'resume' | 'none'}
export interface CarResolveContext {reciters: Reciter[]; topReciterId: string | null; recentTracks: RecentlyPlayedTrack[]; lovedTracks: LovedTrack[]; downloads: DownloadedSurah[]; systemPlaylists: SystemPlaylist[]; playlistItems: Record<string, PlaylistItem[]>}
export function resolveCarRequest(request: CarPlayRequest, ctx: CarResolveContext): CarQueuePlan | null
```

- [ ] **Step 1: Write the failing tests**

```ts
import {resolveCarRequest, CarResolveContext} from '../resolveCarRequest';
import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';

function rewayat(id: string, reciterId: string, list: (number | null)[]): Rewayat {
  return {
    id, reciter_id: reciterId, name: 'Hafs', style: 'murattal', server: 's',
    surah_total: list.length, surah_list: list, source_type: 'r2', created_at: 'x',
  };
}
const r1: Reciter = {id: 'r1', name: 'Mishary', date: null, image_url: null, rewayat: [rewayat('h', 'r1', [1, 2, 3, 4])]};
const r2: Reciter = {id: 'r2', name: 'Sudais', date: null, image_url: null, rewayat: [rewayat('h2', 'r2', [1, null, 3])]};
const surah = (id: number): Surah => ({
  id, name: `S${id}`, revelation_place: 'Makkah', revelation_order: id, bismillah_pre: true,
  name_arabic: '', verses_count: 1, pages: '1', translated_name_english: '',
});

function ctx(o: Partial<CarResolveContext> = {}): CarResolveContext {
  return {
    reciters: [r1, r2], topReciterId: 'r1', recentTracks: [], lovedTracks: [],
    downloads: [], systemPlaylists: [], playlistItems: {}, ...o,
  };
}

describe('resolveCarRequest', () => {
  it('queues the rest of the rewayah starting at the chosen surah, wrapping around', () => {
    const plan = resolveCarRequest({kind: 'surah', reciterId: 'r1', rewayatId: 'h', surahId: 3}, ctx());
    expect(plan?.tracks.map(t => t.surahId)).toEqual([3, 4, 1, 2]);
    expect(plan?.startIndex).toBe(0);
    expect(plan?.chain).toBe('new');
  });

  it('returns null for a surah the rewayah lacks', () => {
    expect(resolveCarRequest({kind: 'surah', reciterId: 'r2', rewayatId: 'h2', surahId: 2}, ctx())).toBeNull();
  });

  it('returns null for an unknown reciter', () => {
    expect(resolveCarRequest({kind: 'surah', reciterId: 'nope', rewayatId: 'h', surahId: 1}, ctx())).toBeNull();
  });

  it('falls back to the first rewayah when the id is stale', () => {
    const plan = resolveCarRequest({kind: 'surah', reciterId: 'r1', rewayatId: 'stale', surahId: 1}, ctx());
    expect(plan?.tracks[0]).toEqual({reciterId: 'r1', rewayatId: 'h', surahId: 1});
  });

  it('resumes the most recent non-upload track at its position', () => {
    const plan = resolveCarRequest({kind: 'resume'}, ctx({
      recentTracks: [
        {reciter: r2, surah: surah(3), rewayatId: 'h2', progress: 0.5, duration: 200, timestamp: 2, isUserUpload: true},
        {reciter: r1, surah: surah(2), rewayatId: 'h', progress: 0.25, duration: 400, timestamp: 1},
      ],
    }));
    expect(plan?.tracks[0]).toEqual({reciterId: 'r1', rewayatId: 'h', surahId: 2});
    expect(plan?.startPosition).toBe(100);
    expect(plan?.chain).toBe('resume');
  });

  it('returns null for resume with no history', () => {
    expect(resolveCarRequest({kind: 'resume'}, ctx())).toBeNull();
  });

  it('plays loved tracks newest first from the start index, skipping uploads', () => {
    const plan = resolveCarRequest({kind: 'loved', startIndex: 1}, ctx({
      lovedTracks: [
        {reciterId: 'r1', surahId: '1', rewayatId: 'h', timestamp: 1},
        {reciterId: 'r1', surahId: '2', rewayatId: 'h', timestamp: 3},
        {reciterId: 'r1', surahId: '9', rewayatId: 'h', timestamp: 2, userRecitationId: 'u'},
      ],
    }));
    expect(plan?.tracks.map(t => t.surahId)).toEqual([2, 1]);
    expect(plan?.startIndex).toBe(1);
    expect(plan?.shuffle).toBe(false);
  });

  it('marks shuffle for shuffle loved', () => {
    const plan = resolveCarRequest({kind: 'loved', shuffle: true}, ctx({
      lovedTracks: [{reciterId: 'r1', surahId: '1', rewayatId: 'h', timestamp: 1}],
    }));
    expect(plan?.shuffle).toBe(true);
  });

  it('fills system playlist items without a reciter using the top reciter', () => {
    const plan = resolveCarRequest({kind: 'playlist', playlistId: 'p', system: true}, ctx({
      systemPlaylists: [{
        id: 'p', title: 'P', description: '', backgroundColor: '#000', type: 'surah-only',
        items: [{surahId: 1}, {surahId: 4}, {surahId: 1, reciterId: 'r2'}],
        heightMultiplier: 1, column: 'left', order: 1,
      }],
    }));
    expect(plan?.tracks).toEqual([
      {reciterId: 'r1', rewayatId: 'h', surahId: 1},
      {reciterId: 'r1', rewayatId: 'h', surahId: 4},
      {reciterId: 'r2', rewayatId: 'h2', surahId: 1},
    ]);
  });

  it('plays user playlist items in order and skips uploads', () => {
    const plan = resolveCarRequest({kind: 'playlist', playlistId: 'u1', system: false}, ctx({
      playlistItems: {u1: [
        {id: 'b', playlistId: 'u1', surahId: '2', reciterId: 'r1', orderIndex: 1, addedAt: 1},
        {id: 'a', playlistId: 'u1', surahId: '1', reciterId: 'r1', orderIndex: 0, addedAt: 1},
        {id: 'c', playlistId: 'u1', surahId: '3', reciterId: 'r1', orderIndex: 2, addedAt: 1, userRecitationId: 'x'},
      ]},
    }));
    expect(plan?.tracks.map(t => t.surahId)).toEqual([1, 2]);
  });

  it('plays completed downloads only', () => {
    const plan = resolveCarRequest({kind: 'downloads'}, ctx({
      downloads: [
        {reciterId: 'r1', surahId: '1', rewayatId: 'h', filePath: 'a', fileSize: 1, downloadDate: 1, status: 'completed'},
        {reciterId: 'r1', surahId: '2', rewayatId: 'h', filePath: 'b', fileSize: 1, downloadDate: 1, status: 'error'},
      ],
    }));
    expect(plan?.tracks.map(t => t.surahId)).toEqual([1]);
  });

  it('clamps an out-of-range start index', () => {
    const plan = resolveCarRequest({kind: 'loved', startIndex: 99}, ctx({
      lovedTracks: [{reciterId: 'r1', surahId: '1', rewayatId: 'h', timestamp: 1}],
    }));
    expect(plan?.startIndex).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest services/car/playback --watchAll=false`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `services/car/playback/resolveCarRequest.ts`**

```ts
import {Reciter} from '@/data/reciterData';
import {SystemPlaylist} from '@/data/systemPlaylists';
import {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {LovedTrack} from '@/services/player/store/lovedStore';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {PlaylistItem} from '@/services/database/DatabaseService';
import {CarPlayRequest} from '@/services/car/types';
import {availableSurahIds} from '@/services/car/snapshot/buildCarSnapshot';

export interface CarTrackSpec {
  reciterId: string;
  rewayatId: string;
  surahId: number;
}

export interface CarQueuePlan {
  tracks: CarTrackSpec[];
  startIndex: number;
  startPosition: number;
  shuffle: boolean;
  chain: 'new' | 'resume' | 'none';
}

export interface CarResolveContext {
  reciters: Reciter[];
  topReciterId: string | null;
  recentTracks: RecentlyPlayedTrack[];
  lovedTracks: LovedTrack[];
  downloads: DownloadedSurah[];
  systemPlaylists: SystemPlaylist[];
  playlistItems: Record<string, PlaylistItem[]>;
}

function spec(
  ctx: CarResolveContext,
  reciterId: string | undefined | null,
  rewayatId: string | undefined,
  surahId: number,
): CarTrackSpec | null {
  const reciter = ctx.reciters.find(r => r.id === reciterId);
  if (!reciter) return null;
  const rewayat = reciter.rewayat.find(r => r.id === rewayatId) ?? reciter.rewayat[0];
  if (!rewayat) return null;
  if (!availableSurahIds(rewayat).includes(surahId)) return null;
  return {reciterId: reciter.id, rewayatId: rewayat.id, surahId};
}

function compact(specs: (CarTrackSpec | null)[]): CarTrackSpec[] {
  return specs.filter((s): s is CarTrackSpec => s !== null);
}

function listPlan(tracks: CarTrackSpec[], startIndex: number | undefined, shuffle: boolean): CarQueuePlan | null {
  if (tracks.length === 0) return null;
  const index = startIndex !== undefined && startIndex >= 0 && startIndex < tracks.length ? startIndex : 0;
  return {tracks, startIndex: index, startPosition: 0, shuffle, chain: 'none'};
}

function surahPlan(
  ctx: CarResolveContext,
  reciterId: string,
  rewayatId: string,
  surahId: number,
  startPosition: number,
  chain: 'new' | 'resume',
): CarQueuePlan | null {
  const first = spec(ctx, reciterId, rewayatId, surahId);
  if (!first) return null;
  const reciter = ctx.reciters.find(r => r.id === first.reciterId);
  const rewayat = reciter?.rewayat.find(r => r.id === first.rewayatId);
  const ids = availableSurahIds(rewayat);
  const at = ids.indexOf(surahId);
  const ordered = [...ids.slice(at), ...ids.slice(0, at)];
  return {
    tracks: ordered.map(id => ({reciterId: first.reciterId, rewayatId: first.rewayatId, surahId: id})),
    startIndex: 0,
    startPosition,
    shuffle: false,
    chain,
  };
}

export function resolveCarRequest(request: CarPlayRequest, ctx: CarResolveContext): CarQueuePlan | null {
  switch (request.kind) {
    case 'surah':
      return surahPlan(ctx, request.reciterId, request.rewayatId, request.surahId, request.startAt ?? 0, 'new');
    case 'resume': {
      const recent = ctx.recentTracks.find(t => !t.isUserUpload);
      if (!recent) return null;
      return surahPlan(ctx, recent.reciter.id, recent.rewayatId, recent.surah.id, recent.progress * recent.duration, 'resume');
    }
    case 'loved': {
      const tracks = compact(
        [...ctx.lovedTracks]
          .filter(t => !t.userRecitationId)
          .sort((a, b) => b.timestamp - a.timestamp)
          .map(t => spec(ctx, t.reciterId, t.rewayatId, Number(t.surahId))),
      );
      return listPlan(tracks, request.startIndex, request.shuffle === true);
    }
    case 'downloads': {
      const tracks = compact(
        ctx.downloads
          .filter(d => d.status === 'completed')
          .map(d => spec(ctx, d.reciterId, d.rewayatId, Number(d.surahId))),
      );
      return listPlan(tracks, request.startIndex, false);
    }
    case 'playlist': {
      if (request.system) {
        const playlist = ctx.systemPlaylists.find(p => p.id === request.playlistId);
        if (!playlist) return null;
        const tracks = compact(
          playlist.items.map(i => spec(ctx, i.reciterId ?? ctx.topReciterId, i.rewayatId, i.surahId)),
        );
        return listPlan(tracks, request.startIndex, false);
      }
      const tracks = compact(
        [...(ctx.playlistItems[request.playlistId] ?? [])]
          .filter(i => !i.userRecitationId)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(i => spec(ctx, i.reciterId, i.rewayatId, Number(i.surahId))),
      );
      return listPlan(tracks, request.startIndex, false);
    }
  }
}
```

Note: the system-playlist test expects `r1`'s rewayah `h` for items with no rewayat; `spec` falls back to the reciter's first rewayah, which matches.

- [ ] **Step 4: Run tests**

Run: `npx jest services/car/playback --watchAll=false`
Expected: PASS (12 tests).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npx tsc --noEmit && npx prettier --write services/car/playback
git add services/car/playback
git commit -m "feat(car): resolve car play requests into queue plans"
```

---

### Task 5: Car integration services in TypeScript

**Files:**
- Modify: `modules/bayaan-car/index.ts`
- Create: `services/car/CarSnapshotService.ts`, `services/car/CarPlaybackBridge.ts`, `services/car/index.ts`
- Test: `services/car/__tests__/CarPlaybackBridge.test.ts`
- Modify: `services/AppInitializer.ts` (call `startCarIntegration()` at the end of `initialize()`)

**Interfaces:**
- Consumes: Tasks 3 and 4; `createTrack` and `shuffleTracks` (`@/utils/track`); `usePlayerStore`, `useRecentlyPlayedStore`, `useLovedStore`, `useDownloadStore`, `useFavoriteRecitersStore` (`@/services/player/store/...`), `usePlaylistsStore`, `useReciterStore` (`@/store/...`), `RECITERS`, `SURAHS`, `getSystemPlaylists`, `SURAH_TO_JUZ`, `getReciterArtwork`.
- Produces (JS API of the native module, consumed by Tasks 6 to 9):
```ts
export interface BayaanCarApi {
  isAvailable: boolean;
  writeSnapshot(json: string): void;
  setNowPlaying(info: CarNowPlaying | null): void;
  markJsReady(): void;
  addPlayRequestListener(fn: (request: CarPlayRequest) => void): () => void;
  addTransportListener(fn: (transport: CarTransport) => void): () => void;
  addConnectionListener(fn: (connected: boolean) => void): () => void;
}
export const BayaanCar: BayaanCarApi;
```
Native event payloads: `onPlayRequest` = `{json: string}` (a `CarPlayRequest` serialized), `onTransport` = `{json: string}` (a `CarTransport`), `onCarConnectionChanged` = `{connected: boolean}`. JSON strings keep both native sides free of nested-type marshalling.

- [ ] **Step 1: Replace `modules/bayaan-car/index.ts`**

```ts
import {requireOptionalNativeModule, EventSubscription} from 'expo-modules-core';
import type {CarNowPlaying, CarPlayRequest, CarTransport} from '@/services/car/types';
import {parseCarPlayRequest, parseCarTransport} from '@/services/car/parse';

interface NativeEvents {
  onPlayRequest: (event: {json: string}) => void;
  onTransport: (event: {json: string}) => void;
  onCarConnectionChanged: (event: {connected: boolean}) => void;
}

interface BayaanCarNative {
  writeSnapshot(json: string): void;
  setNowPlaying(json: string | null): void;
  markJsReady(): void;
  addListener<K extends keyof NativeEvents>(name: K, fn: NativeEvents[K]): EventSubscription;
}

const native = requireOptionalNativeModule<BayaanCarNative>('BayaanCar');

export interface BayaanCarApi {
  isAvailable: boolean;
  writeSnapshot(json: string): void;
  setNowPlaying(info: CarNowPlaying | null): void;
  markJsReady(): void;
  addPlayRequestListener(fn: (request: CarPlayRequest) => void): () => void;
  addTransportListener(fn: (transport: CarTransport) => void): () => void;
  addConnectionListener(fn: (connected: boolean) => void): () => void;
}

function noop(): void {}

export const BayaanCar: BayaanCarApi = {
  isAvailable: native !== null,
  writeSnapshot(json: string): void {
    native?.writeSnapshot(json);
  },
  setNowPlaying(info: CarNowPlaying | null): void {
    native?.setNowPlaying(info ? JSON.stringify(info) : null);
  },
  markJsReady(): void {
    native?.markJsReady();
  },
  addPlayRequestListener(fn: (request: CarPlayRequest) => void): () => void {
    if (!native) return noop;
    const sub = native.addListener('onPlayRequest', ({json}) => {
      const request = parseCarPlayRequest(json);
      if (request) fn(request);
    });
    return () => sub.remove();
  },
  addTransportListener(fn: (transport: CarTransport) => void): () => void {
    if (!native) return noop;
    const sub = native.addListener('onTransport', ({json}) => {
      const transport = parseCarTransport(json);
      if (transport) fn(transport);
    });
    return () => sub.remove();
  },
  addConnectionListener(fn: (connected: boolean) => void): () => void {
    if (!native) return noop;
    const sub = native.addListener('onCarConnectionChanged', ({connected}) => fn(connected));
    return () => sub.remove();
  },
};
```

- [ ] **Step 2: Write `services/car/parse.ts`** (type guards, no casts) and its test

`services/car/parse.ts`:
```ts
import {CarPlayRequest, CarTransport} from '@/services/car/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function safeJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function parseCarPlayRequest(json: string): CarPlayRequest | null {
  const v = safeJson(json);
  if (!isRecord(v)) return null;
  switch (v.kind) {
    case 'surah': {
      const reciterId = str(v.reciterId);
      const rewayatId = str(v.rewayatId);
      const surahId = num(v.surahId);
      if (!reciterId || !rewayatId || surahId === undefined) return null;
      return {kind: 'surah', reciterId, rewayatId, surahId, startAt: num(v.startAt)};
    }
    case 'playlist': {
      const playlistId = str(v.playlistId);
      if (!playlistId) return null;
      return {kind: 'playlist', playlistId, system: v.system === true, startIndex: num(v.startIndex)};
    }
    case 'loved':
      return {kind: 'loved', shuffle: v.shuffle === true, startIndex: num(v.startIndex)};
    case 'downloads':
      return {kind: 'downloads', startIndex: num(v.startIndex)};
    case 'resume':
      return {kind: 'resume'};
    default:
      return null;
  }
}

export function parseCarTransport(json: string): CarTransport | null {
  const v = safeJson(json);
  if (!isRecord(v)) return null;
  switch (v.kind) {
    case 'next':
    case 'previous':
    case 'play':
    case 'pause':
    case 'cycleRate':
    case 'cycleRepeat':
    case 'toggleLove':
      return {kind: v.kind};
    case 'seek': {
      const position = num(v.position);
      return position === undefined ? null : {kind: 'seek', position};
    }
    case 'rate': {
      const value = num(v.value);
      return value === undefined ? null : {kind: 'rate', value};
    }
    case 'jumpTo': {
      const index = num(v.index);
      return index === undefined ? null : {kind: 'jumpTo', index};
    }
    default:
      return null;
  }
}
```

`services/car/__tests__/parse.test.ts`:
```ts
import {parseCarPlayRequest, parseCarTransport} from '../parse';

describe('parse', () => {
  it('parses a surah request', () => {
    expect(parseCarPlayRequest('{"kind":"surah","reciterId":"r","rewayatId":"w","surahId":18}')).toEqual({
      kind: 'surah', reciterId: 'r', rewayatId: 'w', surahId: 18, startAt: undefined,
    });
  });
  it('rejects malformed json and unknown kinds', () => {
    expect(parseCarPlayRequest('{')).toBeNull();
    expect(parseCarPlayRequest('{"kind":"x"}')).toBeNull();
    expect(parseCarPlayRequest('{"kind":"surah","reciterId":"r"}')).toBeNull();
  });
  it('parses transports', () => {
    expect(parseCarTransport('{"kind":"next"}')).toEqual({kind: 'next'});
    expect(parseCarTransport('{"kind":"seek","position":12}')).toEqual({kind: 'seek', position: 12});
    expect(parseCarTransport('{"kind":"seek"}')).toBeNull();
  });
});
```

Run: `npx jest services/car/__tests__/parse.test.ts --watchAll=false` (FAIL first if written before parse.ts, then PASS).

- [ ] **Step 3: Write `services/car/CarSnapshotService.ts`**

```ts
import {Image} from 'react-native';
import {BayaanCar} from '@/modules/bayaan-car';
import {RECITERS, Reciter} from '@/data/reciterData';
import {SURAHS} from '@/data/surahData';
import {getSystemPlaylists} from '@/data/systemPlaylists';
import {SURAH_TO_JUZ} from '@/data/juzData';
import {reciterImages} from '@/utils/reciterImages';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {useReciterStore} from '@/store/reciterStore';
import {PlaylistItem} from '@/services/database/DatabaseService';
import {buildCarSnapshot} from '@/services/car/snapshot/buildCarSnapshot';
import {CarArtwork} from '@/services/car/types';

const DEBOUNCE_MS = 2000;
const CONNECTED_REFRESH_MS = 15 * 60 * 1000;
const MONOGRAM_COLORS = ['#0F766E', '#1D4ED8', '#7C3AED', '#B45309', '#BE123C', '#15803D'];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function monogram(reciter: Reciter): CarArtwork {
  const label = reciter.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
  let hash = 0;
  for (const ch of reciter.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {kind: 'monogram', label, hex: MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length]};
}

export function resolveReciterArtwork(reciter: Reciter): CarArtwork {
  if (reciter.image_url) {
    return {kind: 'url', url: reciter.image_url.replace(/^http:\/\//, 'https://')};
  }
  const asset = reciterImages[slugify(reciter.name)];
  if (asset !== undefined) {
    const resolved = Image.resolveAssetSource(asset);
    if (resolved?.uri) return {kind: 'asset', uri: resolved.uri};
  }
  return monogram(reciter);
}

async function loadPlaylistItems(): Promise<Record<string, PlaylistItem[]>> {
  const {playlists, getPlaylistItems} = usePlaylistsStore.getState();
  const entries = await Promise.all(
    playlists.map(async p => [p.id, await getPlaylistItems(p.id)] as const),
  );
  return Object.fromEntries(entries);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let cachedPlaylistItems: Record<string, PlaylistItem[]> = {};

export function getCachedPlaylistItems(): Record<string, PlaylistItem[]> {
  return cachedPlaylistItems;
}

export async function writeCarSnapshotNow(): Promise<void> {
  cachedPlaylistItems = await loadPlaylistItems();
  const snapshot = buildCarSnapshot({
    now: new Date(),
    reciters: RECITERS,
    surahs: SURAHS,
    favoriteReciterIds: useFavoriteRecitersStore.getState().favoriteReciterIds,
    defaultReciterId: useReciterStore.getState().defaultReciter?.id ?? null,
    recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    lovedTracks: useLovedStore.getState().tracks,
    downloads: useDownloadStore.getState().downloads,
    userPlaylists: usePlaylistsStore.getState().playlists,
    playlistItems: cachedPlaylistItems,
    systemPlaylists: getSystemPlaylists(),
    surahToJuz: SURAH_TO_JUZ,
    resolveReciterArtwork,
  });
  BayaanCar.writeSnapshot(JSON.stringify(snapshot));
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    writeCarSnapshotNow().catch(error => {
      if (__DEV__) console.warn('[CarSnapshotService] write failed', error);
    });
  }, DEBOUNCE_MS);
}

export function startCarSnapshotService(): () => void {
  if (!BayaanCar.isAvailable) return () => {};
  const unsubscribers = [
    useRecentlyPlayedStore.subscribe(schedule),
    useLovedStore.subscribe(schedule),
    useDownloadStore.subscribe(schedule),
    useFavoriteRecitersStore.subscribe(schedule),
    usePlaylistsStore.subscribe(schedule),
    useReciterStore.subscribe(schedule),
    BayaanCar.addConnectionListener(connected => {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = connected ? setInterval(schedule, CONNECTED_REFRESH_MS) : null;
      if (connected) schedule();
    }),
  ];
  writeCarSnapshotNow().catch(() => schedule());
  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    if (timer) clearTimeout(timer);
    if (refreshTimer) clearInterval(refreshTimer);
  };
}
```

Before writing, confirm these names in the codebase and adjust imports if they differ: `useDownloadStore.getState().downloads` (open `services/player/store/downloadStore.ts` near line 90 for the array field name), `useLovedStore.getState().tracks`, `useFavoriteRecitersStore.getState().favoriteReciterIds`, and the slug format used in `utils/artworkUtils.ts` `formatReciterName` (reuse it instead of `slugify` if exported; export it if not). The `as const` in `loadPlaylistItems` is a const assertion on a tuple literal, not a type cast; if the reviewer objects, replace with an explicit `[string, PlaylistItem[]]` return type on the mapper.

Also trigger a write when reciters finish loading: find where `services/dataService.ts` populates `RECITERS` (the splice after API fetch) and, at that point, `import {scheduleCarSnapshot} from '@/services/car/CarSnapshotService'` would create a cycle; instead have `startCarSnapshotService` call `schedule()` from an `AppState` `change` listener to `active` as well. Add:
```ts
import {AppState} from 'react-native';
// inside startCarSnapshotService unsubscribers array:
(() => {
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') schedule();
  });
  return () => sub.remove();
})(),
```

- [ ] **Step 4: Write the failing bridge test**

`services/car/__tests__/CarPlaybackBridge.test.ts`:
```ts
import {toNowPlaying, nextRate, nextRepeat} from '../CarPlaybackBridge';

describe('CarPlaybackBridge helpers', () => {
  it('cycles playback rates 1, 1.25, 1.5, 0.75', () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(1.25)).toBe(1.5);
    expect(nextRate(1.5)).toBe(0.75);
    expect(nextRate(0.75)).toBe(1);
    expect(nextRate(2)).toBe(1);
  });

  it('cycles repeat none, queue, track', () => {
    expect(nextRepeat('none')).toBe('queue');
    expect(nextRepeat('queue')).toBe('track');
    expect(nextRepeat('track')).toBe('none');
  });

  it('maps an empty queue to null', () => {
    expect(toNowPlaying({tracks: [], currentIndex: 0}, {state: 'paused', position: 0, duration: 0, rate: 1}, 'none', false)).toBeNull();
  });

  it('maps the current track', () => {
    const np = toNowPlaying(
      {
        tracks: [{id: 'a', url: 'u', title: 'Al-Kahf', artist: 'Mishary', reciterId: 'r1', reciterName: 'Mishary', surahId: '18'}],
        currentIndex: 0,
      },
      {state: 'playing', position: 10, duration: 100, rate: 1.25},
      'queue',
      true,
    );
    expect(np).toMatchObject({
      title: 'Al-Kahf', subtitle: 'Mishary', reciterId: 'r1', surahId: 18,
      isPlaying: true, position: 10, duration: 100, rate: 1.25, repeatMode: 'queue', isLoved: true,
      artwork: {kind: 'surah', surahId: 18}, currentIndex: 0,
    });
  });
});
```

Run: `npx jest services/car/__tests__/CarPlaybackBridge.test.ts --watchAll=false`
Expected: FAIL, module not found.

- [ ] **Step 5: Implement `services/car/CarPlaybackBridge.ts`**

```ts
import {BayaanCar} from '@/modules/bayaan-car';
import {RECITERS} from '@/data/reciterData';
import {SURAHS} from '@/data/surahData';
import {getSystemPlaylists} from '@/data/systemPlaylists';
import {Track} from '@/types/audio';
import {createTrack, shuffleTracks} from '@/utils/track';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {PlayerState, RepeatMode} from '@/services/player/types/state';
import {resolveCarRequest, CarTrackSpec} from '@/services/car/playback/resolveCarRequest';
import {getCachedPlaylistItems} from '@/services/car/CarSnapshotService';
import {CarNowPlaying, CarPlayRequest, CarTransport} from '@/services/car/types';

const RATES = [1, 1.25, 1.5, 0.75];

export function nextRate(current: number): number {
  const index = RATES.indexOf(current);
  if (index === -1) return 1;
  return RATES[(index + 1) % RATES.length];
}

export function nextRepeat(current: RepeatMode): RepeatMode {
  if (current === 'none') return 'queue';
  if (current === 'queue') return 'track';
  return 'none';
}

interface QueueView {
  tracks: Track[];
  currentIndex: number;
}

interface PlaybackView {
  state: PlayerState;
  position: number;
  duration: number;
  rate: number;
}

function surahNumber(track: Track): number | null {
  const n = Number(track.surahId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function toNowPlaying(
  queue: QueueView,
  playback: PlaybackView,
  repeatMode: RepeatMode,
  isLoved: boolean,
): CarNowPlaying | null {
  const track = queue.tracks[queue.currentIndex];
  if (!track) return null;
  const surahId = surahNumber(track);
  return {
    title: track.title,
    subtitle: track.artist,
    reciterId: track.reciterId || null,
    surahId,
    isPlaying: playback.state === 'playing',
    position: playback.position,
    duration: playback.duration,
    rate: playback.rate,
    repeatMode,
    isLoved,
    artwork: surahId !== null ? {kind: 'surah', surahId} : null,
    queue: queue.tracks.map(t => ({title: t.title, subtitle: t.artist, surahId: surahNumber(t)})),
    currentIndex: queue.currentIndex,
  };
}

async function specToTrack(spec: CarTrackSpec): Promise<Track | null> {
  const reciter = RECITERS.find(r => r.id === spec.reciterId);
  const surah = SURAHS.find(s => s.id === spec.surahId);
  if (!reciter || !surah) return null;
  return createTrack(reciter, surah, spec.rewayatId);
}

export async function executeCarRequest(request: CarPlayRequest): Promise<void> {
  const plan = resolveCarRequest(request, {
    reciters: RECITERS,
    topReciterId: null,
    recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    lovedTracks: useLovedStore.getState().tracks,
    downloads: useDownloadStore.getState().downloads,
    systemPlaylists: getSystemPlaylists(),
    playlistItems: getCachedPlaylistItems(),
  });
  if (!plan) return;

  const built = await Promise.all(plan.tracks.map(specToTrack));
  const tracks = built.filter((t): t is Track => t !== null);
  if (tracks.length === 0) return;

  const ordered = plan.shuffle ? shuffleTracks(tracks) : tracks;
  const startIndex = plan.shuffle ? 0 : Math.min(plan.startIndex, ordered.length - 1);

  const first = plan.tracks[plan.startIndex];
  const reciter = RECITERS.find(r => r.id === first.reciterId);
  const surah = SURAHS.find(s => s.id === first.surahId);
  if (plan.chain === 'new' && reciter && surah) {
    useRecentlyPlayedStore.getState().startNewChain(reciter, surah, 0, 0, first.rewayatId);
  }
  if (plan.chain === 'resume') {
    useRecentlyPlayedStore.getState().resumeChain(0);
  }

  const player = usePlayerStore.getState();
  await player.updateQueue(ordered, startIndex, plan.startPosition);
  await player.play();
}

async function handleTransport(transport: CarTransport): Promise<void> {
  const player = usePlayerStore.getState();
  switch (transport.kind) {
    case 'next':
      return player.skipToNext();
    case 'previous':
      return player.skipToPrevious();
    case 'play':
      return player.play();
    case 'pause':
      return player.pause();
    case 'seek':
      return player.seekTo(transport.position);
    case 'rate':
      return player.setRate(transport.value);
    case 'cycleRate':
      return player.setRate(nextRate(player.playback.rate));
    case 'cycleRepeat':
      player.setRepeatMode(nextRepeat(player.settings.repeatMode));
      return;
    case 'jumpTo':
      return player.updateQueue(player.queue.tracks, transport.index);
    case 'toggleLove': {
      const track = player.queue.tracks[player.queue.currentIndex];
      if (!track?.surahId || !track.rewayatId) return;
      useLovedStore.getState().toggleLoved(track.reciterId, track.surahId, track.rewayatId);
      return;
    }
  }
}

function pushNowPlaying(): void {
  const player = usePlayerStore.getState();
  const track = player.queue.tracks[player.queue.currentIndex];
  const isLoved = track?.surahId && track.rewayatId
    ? useLovedStore.getState().isLovedWithRewayat(track.reciterId, track.surahId, track.rewayatId)
    : false;
  BayaanCar.setNowPlaying(toNowPlaying(player.queue, player.playback, player.settings.repeatMode, isLoved));
}

export function startCarPlaybackBridge(): () => void {
  if (!BayaanCar.isAvailable) return () => {};
  let lastKey = '';
  const unsubscribers = [
    BayaanCar.addPlayRequestListener(request => {
      executeCarRequest(request).catch(error => {
        if (__DEV__) console.warn('[CarPlaybackBridge] play request failed', error);
      });
    }),
    BayaanCar.addTransportListener(transport => {
      handleTransport(transport).catch(error => {
        if (__DEV__) console.warn('[CarPlaybackBridge] transport failed', error);
      });
    }),
    usePlayerStore.subscribe(state => {
      // Position ticks are extrapolated natively; only push on meaningful changes.
      const key = [
        state.queue.currentIndex, state.queue.tracks.length, state.playback.state,
        state.playback.rate, state.settings.repeatMode, Math.round(state.playback.duration),
      ].join('|');
      if (key === lastKey) return;
      lastKey = key;
      pushNowPlaying();
    }),
    useLovedStore.subscribe(pushNowPlaying),
  ];
  pushNowPlaying();
  BayaanCar.markJsReady();
  return () => unsubscribers.forEach(unsubscribe => unsubscribe());
}
```

Before writing, confirm in `services/player/store/playerStore.ts` that the state exposes `playback`, `queue`, `settings` at top level (seen at lines 210 to 295 and in `services/player/types/state.ts`), and that `PlayerState` includes `'playing'`. Also add a seek push: when a `seek` transport completes, call `pushNowPlaying()` so the car's extrapolated position resets.

Fix `topReciterId: null` in `executeCarRequest`: read it from the last snapshot. Add to `CarSnapshotService.ts`:
```ts
let lastTopReciterId: string | null = null;
export function getLastTopReciterId(): string | null {
  return lastTopReciterId;
}
// in writeCarSnapshotNow, after building:
lastTopReciterId = snapshot.topReciterId;
```
and pass `topReciterId: getLastTopReciterId()` in `executeCarRequest`.

- [ ] **Step 6: Write `services/car/index.ts` and wire startup**

```ts
import {startCarSnapshotService} from './CarSnapshotService';
import {startCarPlaybackBridge} from './CarPlaybackBridge';

export function startCarIntegration(): () => void {
  const stopSnapshot = startCarSnapshotService();
  const stopBridge = startCarPlaybackBridge();
  return () => {
    stopBridge();
    stopSnapshot();
  };
}
```

In `services/AppInitializer.ts`, at the end of the successful path of `initialize()`, add `startCarIntegration();` (import from `@/services/car`). Read the file first and place it after the player store and data service are ready (after reciters load), guarded so it runs once.

- [ ] **Step 7: Run tests, typecheck, format, commit**

```bash
npx jest services/car --watchAll=false
npx tsc --noEmit
npx prettier --write services/car modules/bayaan-car/index.ts services/AppInitializer.ts
git add services/car modules/bayaan-car/index.ts services/AppInitializer.ts
git commit -m "feat(car): snapshot service and playback bridge"
```

Expected: all car tests PASS; tsc clean. The app still runs normally on web and in Jest because `requireOptionalNativeModule` returns null there.

---

### Task 6: Native bridge core (iOS and Android)

Implements the module functions, events, snapshot storage and the pending-request queue on both platforms.

**Files:**
- Create: `modules/bayaan-car/ios/CarBridge.swift`, `modules/bayaan-car/ios/CarSnapshot.swift`
- Modify: `modules/bayaan-car/ios/BayaanCarModule.swift`
- Create: `modules/bayaan-car/android/src/main/java/expo/modules/bayaancar/CarBridge.kt`, `.../CarSnapshot.kt`
- Modify: `.../BayaanCarModule.kt`

**Interfaces:**
- Produces (iOS): `CarBridge.shared.snapshot: CarSnapshot?`, `CarBridge.shared.nowPlaying: CarNowPlaying?`, `CarBridge.shared.send(play: [String: Any])`, `CarBridge.shared.send(transport: [String: Any])`, `CarBridge.shared.setConnected(_:)`, notifications `CarBridge.snapshotDidChange`, `CarBridge.nowPlayingDidChange`.
- Produces (Android): `CarBridge.snapshot: CarSnapshot?`, `CarBridge.nowPlaying: CarNowPlaying?`, `CarBridge.sendPlay(json: String)`, `CarBridge.sendTransport(json: String)`, `CarBridge.setConnected(Boolean)`, listeners `CarBridge.onSnapshotChanged`, `CarBridge.onNowPlayingChanged`.

- [ ] **Step 1: `CarSnapshot.swift`** (Codable mirror of `services/car/types.ts`)

```swift
import Foundation

enum CarArtwork: Decodable {
  case surah(Int)
  case url(String)
  case asset(String)
  case monogram(label: String, hex: String)
  case color(label: String, hex: String)

  private enum Keys: String, CodingKey { case kind, surahId, url, uri, label, hex }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    switch try c.decode(String.self, forKey: .kind) {
    case "surah": self = .surah(try c.decode(Int.self, forKey: .surahId))
    case "url": self = .url(try c.decode(String.self, forKey: .url))
    case "asset": self = .asset(try c.decode(String.self, forKey: .uri))
    case "monogram": self = .monogram(label: try c.decode(String.self, forKey: .label), hex: try c.decode(String.self, forKey: .hex))
    default: self = .color(label: try c.decode(String.self, forKey: .label), hex: try c.decode(String.self, forKey: .hex))
    }
  }
}

/// Requests stay as raw JSON objects: native never interprets them, it only
/// forwards them to JS.
struct RawJSON: Decodable {
  let value: [String: Any]
  init(from decoder: Decoder) throws {
    let data = try JSONSerialization.data(withJSONObject: try AnyDecodable(from: decoder).value)
    value = (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
  }
}

struct AnyDecodable: Decodable {
  let value: Any
  init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if let v = try? c.decode(Bool.self) { value = v }
    else if let v = try? c.decode(Double.self) { value = v }
    else if let v = try? c.decode(String.self) { value = v }
    else if let v = try? c.decode([String: AnyDecodable].self) { value = v.mapValues { $0.value } }
    else if let v = try? c.decode([AnyDecodable].self) { value = v.map { $0.value } }
    else { value = NSNull() }
  }
}

enum CarItemAction: Decodable {
  case play(RawJSON)
  case browseList(String)
  case browseReciter(String)
  case browseSurahReciters(Int)

  private enum Keys: String, CodingKey { case kind, request, target }
  private enum TargetKeys: String, CodingKey { case kind, listId, reciterId, surahId }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    if try c.decode(String.self, forKey: .kind) == "play" {
      self = .play(try c.decode(RawJSON.self, forKey: .request))
      return
    }
    let t = try c.nestedContainer(keyedBy: TargetKeys.self, forKey: .target)
    switch try t.decode(String.self, forKey: .kind) {
    case "reciter": self = .browseReciter(try t.decode(String.self, forKey: .reciterId))
    case "surahReciters": self = .browseSurahReciters(try t.decode(Int.self, forKey: .surahId))
    default: self = .browseList(try t.decode(String.self, forKey: .listId))
    }
  }
}

struct CarItem: Decodable {
  let id: String
  let title: String
  let subtitle: String?
  let artwork: CarArtwork
  let progress: Double?
  let isDownloaded: Bool?
  let action: CarItemAction
}

struct CarSection: Decodable {
  let id: String
  let title: String
  let style: String
  let items: [CarItem]
}

struct CarList: Decodable {
  let id: String
  let title: String
  let items: [CarItem]
}

struct CarRewayah: Decodable {
  let id: String
  let name: String
  let style: String
  let surahIds: [Int]
}

struct CarReciter: Decodable {
  let id: String
  let name: String
  let artwork: CarArtwork
  let isFavorite: Bool
  let rewayat: [CarRewayah]
}

struct CarSurah: Decodable {
  let id: Int
  let name: String
  let nameArabic: String
  let translation: String
  let versesCount: Int
}

struct CarHome: Decodable {
  let quickStart: [CarItem]
  let sections: [CarSection]
}

struct CarJuz: Decodable {
  let number: Int
  let surahIds: [Int]
}

struct CarSnapshot: Decodable {
  let version: Int
  let topReciterId: String?
  let home: CarHome
  let library: [CarItem]
  let lists: [String: CarList]
  let reciters: [CarReciter]
  let surahs: [CarSurah]
  let juz: [CarJuz]
  let downloadedKeys: [String]
}

struct CarQueueEntry: Decodable {
  let title: String
  let subtitle: String
  let surahId: Int?
}

struct CarNowPlaying: Decodable {
  let title: String
  let subtitle: String
  let reciterId: String?
  let surahId: Int?
  let isPlaying: Bool
  let position: Double
  let duration: Double
  let rate: Double
  let repeatMode: String
  let isLoved: Bool
  let queue: [CarQueueEntry]
  let currentIndex: Int
}
```

`RawJSON` uses `as? [String: Any]` on `JSONSerialization` output; this is Swift, outside the TS cast rule.

- [ ] **Step 2: `CarBridge.swift`**

```swift
import Foundation

final class CarBridge {
  static let shared = CarBridge()
  static let snapshotDidChange = Notification.Name("BayaanCarSnapshotDidChange")
  static let nowPlayingDidChange = Notification.Name("BayaanCarNowPlayingDidChange")

  private(set) var snapshot: CarSnapshot?
  private(set) var nowPlaying: CarNowPlaying?
  private(set) var isConnected = false

  /// Set by BayaanCarModule. Nil until JS calls markJsReady.
  var emit: ((String, [String: Any]) -> Void)?
  private var jsReady = false
  private var pending: [(String, [String: Any])] = []

  private var snapshotURL: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return base.appendingPathComponent("bayaan-car/snapshot.json")
  }

  private init() {
    loadSnapshotFromDisk()
  }

  func writeSnapshot(json: String) {
    guard let data = json.data(using: .utf8),
          let decoded = try? JSONDecoder().decode(CarSnapshot.self, from: data),
          decoded.version == 1 else { return }
    let url = snapshotURL
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try? data.write(to: url, options: .atomic)
    DispatchQueue.main.async {
      self.snapshot = decoded
      NotificationCenter.default.post(name: CarBridge.snapshotDidChange, object: nil)
    }
  }

  func setNowPlaying(json: String?) {
    let decoded = json.flatMap { $0.data(using: .utf8) }.flatMap { try? JSONDecoder().decode(CarNowPlaying.self, from: $0) }
    DispatchQueue.main.async {
      self.nowPlaying = decoded
      NotificationCenter.default.post(name: CarBridge.nowPlayingDidChange, object: nil)
    }
  }

  func markJsReady() {
    DispatchQueue.main.async {
      self.jsReady = true
      let queued = self.pending
      self.pending.removeAll()
      queued.forEach { self.emit?($0.0, $0.1) }
      self.emit?("onCarConnectionChanged", ["connected": self.isConnected])
    }
  }

  func send(play request: [String: Any]) {
    send(event: "onPlayRequest", payload: request)
  }

  func send(transport: [String: Any]) {
    send(event: "onTransport", payload: transport)
  }

  func setConnected(_ connected: Bool) {
    isConnected = connected
    guard jsReady else { return }
    emit?("onCarConnectionChanged", ["connected": connected])
  }

  private func send(event: String, payload: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: payload),
          let json = String(data: data, encoding: .utf8) else { return }
    DispatchQueue.main.async {
      let body: [String: Any] = ["json": json]
      if self.jsReady, let emit = self.emit {
        emit(event, body)
      } else {
        // Only the latest play request matters; transports queue in order.
        if event == "onPlayRequest" { self.pending.removeAll { $0.0 == "onPlayRequest" } }
        self.pending.append((event, body))
      }
    }
  }

  private func loadSnapshotFromDisk() {
    guard let data = try? Data(contentsOf: snapshotURL) else { return }
    snapshot = try? JSONDecoder().decode(CarSnapshot.self, from: data)
  }
}
```

- [ ] **Step 3: `BayaanCarModule.swift`**

```swift
import ExpoModulesCore

public class BayaanCarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BayaanCar")
    Events("onPlayRequest", "onTransport", "onCarConnectionChanged")

    OnCreate {
      CarBridge.shared.emit = { [weak self] name, body in
        self?.sendEvent(name, body)
      }
    }

    Function("writeSnapshot") { (json: String) in
      CarBridge.shared.writeSnapshot(json: json)
    }

    Function("setNowPlaying") { (json: String?) in
      CarBridge.shared.setNowPlaying(json: json)
    }

    Function("markJsReady") {
      CarBridge.shared.markJsReady()
    }
  }
}
```

- [ ] **Step 4: Android `CarSnapshot.kt`** (org.json parsing; mirrors Step 1)

```kotlin
package expo.modules.bayaancar

import org.json.JSONArray
import org.json.JSONObject

sealed class CarArtwork {
  data class Surah(val surahId: Int) : CarArtwork()
  data class Url(val url: String) : CarArtwork()
  data class Asset(val uri: String) : CarArtwork()
  data class Monogram(val label: String, val hex: String) : CarArtwork()
  data class Color(val label: String, val hex: String) : CarArtwork()

  companion object {
    fun parse(o: JSONObject): CarArtwork = when (o.optString("kind")) {
      "surah" -> Surah(o.getInt("surahId"))
      "url" -> Url(o.getString("url"))
      "asset" -> Asset(o.getString("uri"))
      "monogram" -> Monogram(o.getString("label"), o.getString("hex"))
      else -> Color(o.optString("label"), o.optString("hex", "#333333"))
    }
  }
}

sealed class CarItemAction {
  data class Play(val requestJson: String) : CarItemAction()
  data class BrowseList(val listId: String) : CarItemAction()
  data class BrowseReciter(val reciterId: String) : CarItemAction()
  data class BrowseSurahReciters(val surahId: Int) : CarItemAction()

  companion object {
    fun parse(o: JSONObject): CarItemAction {
      if (o.optString("kind") == "play") return Play(o.getJSONObject("request").toString())
      val t = o.getJSONObject("target")
      return when (t.optString("kind")) {
        "reciter" -> BrowseReciter(t.getString("reciterId"))
        "surahReciters" -> BrowseSurahReciters(t.getInt("surahId"))
        else -> BrowseList(t.getString("listId"))
      }
    }
  }
}

data class CarItem(
  val id: String,
  val title: String,
  val subtitle: String?,
  val artwork: CarArtwork,
  val progress: Double?,
  val isDownloaded: Boolean,
  val action: CarItemAction,
) {
  companion object {
    fun parse(o: JSONObject) = CarItem(
      id = o.getString("id"),
      title = o.getString("title"),
      subtitle = if (o.has("subtitle")) o.getString("subtitle") else null,
      artwork = CarArtwork.parse(o.getJSONObject("artwork")),
      progress = if (o.has("progress")) o.getDouble("progress") else null,
      isDownloaded = o.optBoolean("isDownloaded", false),
      action = CarItemAction.parse(o.getJSONObject("action")),
    )
  }
}

data class CarSection(val id: String, val title: String, val style: String, val items: List<CarItem>)
data class CarList(val id: String, val title: String, val items: List<CarItem>)
data class CarRewayah(val id: String, val name: String, val style: String, val surahIds: List<Int>)
data class CarReciter(val id: String, val name: String, val artwork: CarArtwork, val isFavorite: Boolean, val rewayat: List<CarRewayah>)
data class CarSurah(val id: Int, val name: String, val nameArabic: String, val translation: String, val versesCount: Int)
data class CarJuz(val number: Int, val surahIds: List<Int>)

data class CarSnapshot(
  val topReciterId: String?,
  val quickStart: List<CarItem>,
  val sections: List<CarSection>,
  val library: List<CarItem>,
  val lists: Map<String, CarList>,
  val reciters: List<CarReciter>,
  val surahs: List<CarSurah>,
  val juz: List<CarJuz>,
  val downloadedKeys: Set<String>,
) {
  companion object {
    private fun <T> JSONArray.mapObjects(f: (JSONObject) -> T): List<T> = (0 until length()).map { f(getJSONObject(it)) }
    private fun JSONArray.ints(): List<Int> = (0 until length()).map { getInt(it) }

    fun parse(json: String): CarSnapshot? = runCatching {
      val o = JSONObject(json)
      if (o.getInt("version") != 1) return null
      val home = o.getJSONObject("home")
      val listsObj = o.getJSONObject("lists")
      CarSnapshot(
        topReciterId = if (o.isNull("topReciterId")) null else o.getString("topReciterId"),
        quickStart = home.getJSONArray("quickStart").mapObjects(CarItem::parse),
        sections = home.getJSONArray("sections").mapObjects {
          CarSection(it.getString("id"), it.getString("title"), it.getString("style"), it.getJSONArray("items").mapObjects(CarItem::parse))
        },
        library = o.getJSONArray("library").mapObjects(CarItem::parse),
        lists = listsObj.keys().asSequence().associateWith { key ->
          val l = listsObj.getJSONObject(key)
          CarList(l.getString("id"), l.getString("title"), l.getJSONArray("items").mapObjects(CarItem::parse))
        },
        reciters = o.getJSONArray("reciters").mapObjects { r ->
          CarReciter(
            r.getString("id"), r.getString("name"), CarArtwork.parse(r.getJSONObject("artwork")), r.getBoolean("isFavorite"),
            r.getJSONArray("rewayat").mapObjects { w -> CarRewayah(w.getString("id"), w.getString("name"), w.getString("style"), w.getJSONArray("surahIds").ints()) },
          )
        },
        surahs = o.getJSONArray("surahs").mapObjects { s ->
          CarSurah(s.getInt("id"), s.getString("name"), s.getString("nameArabic"), s.getString("translation"), s.getInt("versesCount"))
        },
        juz = o.getJSONArray("juz").mapObjects { j -> CarJuz(j.getInt("number"), j.getJSONArray("surahIds").ints()) },
        downloadedKeys = o.getJSONArray("downloadedKeys").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() },
      )
    }.getOrNull()
  }
}

data class CarQueueEntry(val title: String, val subtitle: String, val surahId: Int?)

data class CarNowPlaying(
  val title: String,
  val subtitle: String,
  val reciterId: String?,
  val surahId: Int?,
  val isPlaying: Boolean,
  val positionSec: Double,
  val durationSec: Double,
  val rate: Double,
  val repeatMode: String,
  val isLoved: Boolean,
  val queue: List<CarQueueEntry>,
  val currentIndex: Int,
  val receivedAtMs: Long,
) {
  companion object {
    fun parse(json: String): CarNowPlaying? = runCatching {
      val o = JSONObject(json)
      val q = o.getJSONArray("queue")
      CarNowPlaying(
        title = o.getString("title"),
        subtitle = o.getString("subtitle"),
        reciterId = if (o.isNull("reciterId")) null else o.getString("reciterId"),
        surahId = if (o.isNull("surahId")) null else o.getInt("surahId"),
        isPlaying = o.getBoolean("isPlaying"),
        positionSec = o.getDouble("position"),
        durationSec = o.getDouble("duration"),
        rate = o.getDouble("rate"),
        repeatMode = o.getString("repeatMode"),
        isLoved = o.getBoolean("isLoved"),
        queue = (0 until q.length()).map { i ->
          val e = q.getJSONObject(i)
          CarQueueEntry(e.getString("title"), e.getString("subtitle"), if (e.isNull("surahId")) null else e.getInt("surahId"))
        },
        currentIndex = o.getInt("currentIndex"),
        receivedAtMs = android.os.SystemClock.elapsedRealtime(),
      )
    }.getOrNull()
  }
}
```

- [ ] **Step 5: Android `CarBridge.kt`**

```kotlin
package expo.modules.bayaancar

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.io.File

object CarBridge {
  private val main = Handler(Looper.getMainLooper())
  private var file: File? = null

  var snapshot: CarSnapshot? = null
    private set
  var nowPlaying: CarNowPlaying? = null
    private set
  var isConnected = false
    private set

  var emit: ((String, Map<String, Any>) -> Unit)? = null
  val onSnapshotChanged = mutableListOf<() -> Unit>()
  val onNowPlayingChanged = mutableListOf<() -> Unit>()

  private var jsReady = false
  private val pending = mutableListOf<Pair<String, Map<String, Any>>>()

  fun init(context: Context) {
    if (file != null) return
    val f = File(context.filesDir, "bayaan-car/snapshot.json")
    file = f
    if (f.exists()) snapshot = CarSnapshot.parse(f.readText())
  }

  fun writeSnapshot(json: String) {
    val parsed = CarSnapshot.parse(json) ?: return
    file?.let { f ->
      f.parentFile?.mkdirs()
      val tmp = File(f.parentFile, "snapshot.json.tmp")
      tmp.writeText(json)
      tmp.renameTo(f)
    }
    main.post {
      snapshot = parsed
      onSnapshotChanged.forEach { it() }
    }
  }

  fun setNowPlaying(json: String?) {
    val parsed = json?.let { CarNowPlaying.parse(it) }
    main.post {
      nowPlaying = parsed
      onNowPlayingChanged.forEach { it() }
    }
  }

  fun markJsReady() = main.post {
    jsReady = true
    val queued = pending.toList()
    pending.clear()
    queued.forEach { (name, body) -> emit?.invoke(name, body) }
    emit?.invoke("onCarConnectionChanged", mapOf("connected" to isConnected))
  }

  fun sendPlay(requestJson: String) = send("onPlayRequest", requestJson)
  fun sendTransport(transportJson: String) = send("onTransport", transportJson)

  fun setConnected(connected: Boolean) = main.post {
    isConnected = connected
    if (jsReady) emit?.invoke("onCarConnectionChanged", mapOf("connected" to connected))
  }

  private fun send(event: String, json: String) = main.post {
    val body = mapOf<String, Any>("json" to json)
    val e = emit
    if (jsReady && e != null) {
      e(event, body)
      return@post
    }
    if (event == "onPlayRequest") pending.removeAll { it.first == "onPlayRequest" }
    pending.add(event to body)
  }
}
```

- [ ] **Step 6: Android `BayaanCarModule.kt`**

```kotlin
package expo.modules.bayaancar

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BayaanCarModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BayaanCar")
    Events("onPlayRequest", "onTransport", "onCarConnectionChanged")

    OnCreate {
      appContext.reactContext?.applicationContext?.let { CarBridge.init(it) }
      CarBridge.emit = { name, body -> sendEvent(name, body) }
    }

    OnDestroy {
      CarBridge.emit = null
    }

    Function("writeSnapshot") { json: String -> CarBridge.writeSnapshot(json) }
    Function("setNowPlaying") { json: String? -> CarBridge.setNowPlaying(json) }
    Function("markJsReady") { CarBridge.markJsReady() }
  }
}
```

Note on JS reload in development: `OnDestroy` clears `emit`, but `jsReady` stays true; after a Metro reload, `markJsReady` runs again and re-sets the emitter in `OnCreate`. Requests arriving between destroy and create are dropped in dev only; acceptable.

- [ ] **Step 7: Build both platforms**

Run: `npx expo prebuild --clean && cd android && ./gradlew :app:assembleDebug && cd .. && xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' IPHONEOS_DEPLOYMENT_TARGET=16.4 build | tail -3`
Expected: both builds succeed.

- [ ] **Step 8: Verify the round trip on a simulator**

Run the app on the iOS Simulator with Metro. In the app's dev console (or a temporary `__DEV__` log in `CarSnapshotService.writeCarSnapshotNow`), confirm `[CarSnapshotService]` writes without warnings. Then:
`find ~/Library/Developer/CoreSimulator/Devices/*/data/Containers/Data/Application -path '*bayaan-car/snapshot.json' -newer /tmp -print | head -1 | xargs python3 -m json.tool | head -30`
Expected: a JSON snapshot with `"version": 1` and non-empty `reciters`.

- [ ] **Step 9: Commit**

```bash
git add modules/bayaan-car
git commit -m "feat(car): native bridge, snapshot storage and event queue"
```

---

### Task 7: CarPlay templates

**Files:**
- Create: `modules/bayaan-car/ios/CarTemplateBuilder.swift`, `modules/bayaan-car/ios/CarArtworkCache.swift`
- Modify: `modules/bayaan-car/ios/CarPlaySceneDelegate.swift`

**Interfaces:**
- Consumes: `CarBridge` (Task 6).
- Produces: `CarArtworkCache.shared.image(for: CarArtwork, size: CGFloat, style: UIUserInterfaceStyle, completion: (UIImage) -> Void) -> UIImage` (returns a placeholder synchronously, calls completion when the real image is ready); `CarTemplateBuilder` with `tabTemplates() -> [CPTemplate]`, `refresh()`, and handlers that call `CarBridge.shared.send(play:)` then push `CPNowPlayingTemplate.shared`.

- [ ] **Step 1: `CarArtworkCache.swift`**

```swift
import UIKit

final class CarArtworkCache {
  static let shared = CarArtworkCache()

  private let memory = NSCache<NSString, UIImage>()
  private let dir: URL
  private let session = URLSession(configuration: .default)
  private let surahBase = "https://cdn.thebayaan.com/assets/og-images/surah/"
  private let targetPixels: CGFloat = 256

  private init() {
    let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    dir = base.appendingPathComponent("bayaan-car/artwork", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  }

  /// Returns something drawable immediately. `completion` fires on main with
  /// the real image when it was not already cached.
  func image(for artwork: CarArtwork, style: UIUserInterfaceStyle, completion: @escaping (UIImage) -> Void) -> UIImage {
    switch artwork {
    case .monogram(let label, let hex), .color(let label, let hex):
      return tile(label: label, hex: hex)
    case .surah(let id):
      let suffix = style == .light ? "-light" : ""
      return remote(key: "surah-\(id)\(suffix)", url: URL(string: "\(surahBase)\(id)\(suffix).png"), placeholder: tile(label: "\(id)", hex: "#1F2937"), completion: completion)
    case .url(let string):
      return remote(key: "url-\(string.hashValue)", url: URL(string: string), placeholder: tile(label: "", hex: "#374151"), completion: completion)
    case .asset(let uri):
      if uri.hasPrefix("http") {
        return remote(key: "asset-\(uri.hashValue)", url: URL(string: uri), placeholder: tile(label: "", hex: "#374151"), completion: completion)
      }
      let path = uri.hasPrefix("file://") ? String(uri.dropFirst(7)) : uri
      return UIImage(contentsOfFile: path).map(downscale) ?? tile(label: "", hex: "#374151")
    }
  }

  private func remote(key: String, url: URL?, placeholder: UIImage, completion: @escaping (UIImage) -> Void) -> UIImage {
    if let hit = memory.object(forKey: key as NSString) { return hit }
    let file = dir.appendingPathComponent("\(key).png")
    if let data = try? Data(contentsOf: file), let image = UIImage(data: data) {
      memory.setObject(image, forKey: key as NSString)
      return image
    }
    guard let url else { return placeholder }
    session.dataTask(with: url) { [weak self] data, _, _ in
      guard let self, let data, let full = UIImage(data: data) else { return }
      let small = self.downscale(full)
      if let png = small.pngData() { try? png.write(to: file, options: .atomic) }
      self.memory.setObject(small, forKey: key as NSString)
      DispatchQueue.main.async { completion(small) }
    }.resume()
    return placeholder
  }

  private func downscale(_ image: UIImage) -> UIImage {
    let side = targetPixels / UIScreen.main.scale
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
    return renderer.image { _ in image.draw(in: CGRect(x: 0, y: 0, width: side, height: side)) }
  }

  private func tile(label: String, hex: String) -> UIImage {
    let key = "tile-\(label)-\(hex)" as NSString
    if let hit = memory.object(forKey: key) { return hit }
    let side = targetPixels / UIScreen.main.scale
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
    let image = renderer.image { ctx in
      UIColor(hex: hex).setFill()
      ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
      let attrs: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: side * 0.3, weight: .semibold),
        .foregroundColor: UIColor.white,
      ]
      let size = (label as NSString).size(withAttributes: attrs)
      (label as NSString).draw(at: CGPoint(x: (side - size.width) / 2, y: (side - size.height) / 2), withAttributes: attrs)
    }
    memory.setObject(image, forKey: key)
    return image
  }
}

extension UIColor {
  convenience init(hex: String) {
    let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var value: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&value)
    self.init(
      red: CGFloat((value >> 16) & 0xFF) / 255,
      green: CGFloat((value >> 8) & 0xFF) / 255,
      blue: CGFloat(value & 0xFF) / 255,
      alpha: 1)
  }
}
```

- [ ] **Step 2: `CarTemplateBuilder.swift`**

```swift
import CarPlay
import UIKit

final class CarTemplateBuilder {
  private weak var interfaceController: CPInterfaceController?
  private let style: () -> UIUserInterfaceStyle
  private let homeTemplate = CPListTemplate(title: "Home", sections: [])
  private let libraryTemplate = CPListTemplate(title: "Library", sections: [])
  private let recitersTemplate = CPListTemplate(title: "Reciters", sections: [])
  private let surahsTemplate = CPListTemplate(title: "Surahs", sections: [])

  init(interfaceController: CPInterfaceController, style: @escaping () -> UIUserInterfaceStyle) {
    self.interfaceController = interfaceController
    self.style = style
    homeTemplate.tabTitle = "Home"
    homeTemplate.tabImage = UIImage(systemName: "house.fill")
    libraryTemplate.tabTitle = "Library"
    libraryTemplate.tabImage = UIImage(systemName: "books.vertical.fill")
    recitersTemplate.tabTitle = "Reciters"
    recitersTemplate.tabImage = UIImage(systemName: "person.2.fill")
    surahsTemplate.tabTitle = "Surahs"
    surahsTemplate.tabImage = UIImage(systemName: "list.number")
  }

  func tabTemplates() -> [CPTemplate] {
    refresh()
    return [homeTemplate, libraryTemplate, recitersTemplate, surahsTemplate]
  }

  func refresh() {
    guard let snapshot = CarBridge.shared.snapshot else {
      let empty = [CPListSection(items: [CPListItem(text: "Open Bayaan on your phone to get started", detailText: nil)])]
      [homeTemplate, libraryTemplate, recitersTemplate, surahsTemplate].forEach { $0.updateSections(empty) }
      return
    }
    homeTemplate.updateSections(homeSections(snapshot))
    libraryTemplate.updateSections([CPListSection(items: snapshot.library.map(listItem))])
    recitersTemplate.updateSections(reciterSections(snapshot))
    surahsTemplate.updateSections(surahSections(snapshot))
  }

  // MARK: Home

  private func homeSections(_ s: CarSnapshot) -> [CPListSection] {
    var sections: [CPListSection] = []
    if !s.home.quickStart.isEmpty {
      sections.append(CPListSection(items: [imageRow(title: "Quick start", items: s.home.quickStart)], header: nil, sectionIndexTitle: nil))
    }
    for section in s.home.sections {
      switch section.style {
      case "circles", "cards":
        sections.append(CPListSection(items: [imageRow(title: section.title, items: section.items)]))
      default:
        sections.append(CPListSection(items: section.items.map(listItem), header: section.title, sectionIndexTitle: nil))
      }
    }
    return sections
  }

  private func imageRow(title: String, items: [CarItem]) -> CPListImageRowItem {
    let limited = Array(items.prefix(CPMaximumNumberOfGridImages))
    let images = limited.map { item -> UIImage in
      CarArtworkCache.shared.image(for: item.artwork, style: style()) { [weak self] _ in self?.refreshSoon() }
    }
    let row = CPListImageRowItem(text: title, images: images)
    row.listImageRowHandler = { [weak self] _, index, completion in
      if index < limited.count { self?.perform(limited[index]) }
      completion()
    }
    row.handler = { _, completion in completion() }
    return row
  }

  // MARK: Generic items

  private func listItem(_ item: CarItem) -> CPListItem {
    let image = CarArtworkCache.shared.image(for: item.artwork, style: style()) { [weak self] _ in self?.refreshSoon() }
    let row = CPListItem(text: item.title, detailText: item.subtitle, image: image)
    if let progress = item.progress { row.playbackProgress = CGFloat(min(max(progress, 0), 1)) }
    if case .play = item.action {} else { row.accessoryType = .disclosureIndicator }
    row.handler = { [weak self] _, completion in
      self?.perform(item)
      completion()
    }
    return row
  }

  private func perform(_ item: CarItem) {
    switch item.action {
    case .play(let raw):
      play(raw.value)
    case .browseList(let id):
      pushList(id)
    case .browseReciter(let id):
      pushReciter(id)
    case .browseSurahReciters(let id):
      pushSurahReciters(id)
    }
  }

  private func play(_ request: [String: Any]) {
    CarBridge.shared.send(play: request)
    guard let ic = interfaceController else { return }
    if ic.topTemplate !== CPNowPlayingTemplate.shared {
      ic.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
    }
  }

  private func pushList(_ id: String) {
    guard let list = CarBridge.shared.snapshot?.lists[id] else { return }
    let items = list.items.isEmpty ? [CPListItem(text: "Nothing here yet", detailText: nil)] : list.items.map(listItem)
    interfaceController?.pushTemplate(CPListTemplate(title: list.title, sections: [CPListSection(items: items)]), animated: true, completion: nil)
  }

  // MARK: Reciters

  private func reciterSections(_ s: CarSnapshot) -> [CPListSection] {
    let favorites = s.reciters.filter { $0.isFavorite }
    let others = s.reciters.filter { !$0.isFavorite }
    var sections: [CPListSection] = []
    if !favorites.isEmpty {
      sections.append(CPListSection(items: favorites.map(reciterItem), header: "Favorites", sectionIndexTitle: nil))
    }
    let maxItems = CPListTemplate.maximumItemCount - favorites.count
    sections.append(CPListSection(items: others.prefix(max(maxItems, 0)).map(reciterItem), header: "All reciters", sectionIndexTitle: nil))
    return sections
  }

  private func reciterItem(_ r: CarReciter) -> CPListItem {
    let image = CarArtworkCache.shared.image(for: r.artwork, style: style()) { [weak self] _ in self?.refreshSoon() }
    let item = CPListItem(text: r.name, detailText: r.rewayat.count > 1 ? "\(r.rewayat.count) rewayat" : nil, image: image)
    item.accessoryType = .disclosureIndicator
    item.handler = { [weak self] _, completion in
      self?.pushReciter(r.id)
      completion()
    }
    return item
  }

  private func pushReciter(_ id: String) {
    guard let reciter = CarBridge.shared.snapshot?.reciters.first(where: { $0.id == id }) else { return }
    if reciter.rewayat.count == 1, let only = reciter.rewayat.first {
      pushRewayah(reciter, only)
      return
    }
    let items = reciter.rewayat.map { w -> CPListItem in
      let item = CPListItem(text: w.name, detailText: "\(w.surahIds.count) surahs")
      item.accessoryType = .disclosureIndicator
      item.handler = { [weak self] _, completion in
        self?.pushRewayah(reciter, w)
        completion()
      }
      return item
    }
    interfaceController?.pushTemplate(CPListTemplate(title: reciter.name, sections: [CPListSection(items: items)]), animated: true, completion: nil)
  }

  private func pushRewayah(_ reciter: CarReciter, _ rewayah: CarRewayah) {
    guard let s = CarBridge.shared.snapshot else { return }
    let downloaded = Set(s.downloadedKeys)
    let items = rewayah.surahIds.compactMap { sid -> CPListItem? in
      guard let surah = s.surahs.first(where: { $0.id == sid }) else { return nil }
      let image = CarArtworkCache.shared.image(for: .surah(sid), style: style()) { [weak self] _ in self?.refreshSoon() }
      let isDownloaded = downloaded.contains("\(reciter.id):\(rewayah.id):\(sid)")
      let item = CPListItem(text: "\(sid). \(surah.name)", detailText: isDownloaded ? "\(surah.translation) · Downloaded" : surah.translation, image: image)
      item.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": reciter.id, "rewayatId": rewayah.id, "surahId": sid])
        completion()
      }
      return item
    }
    let template = CPListTemplate(title: reciter.name, sections: [CPListSection(items: items)])
    interfaceController?.pushTemplate(template, animated: true, completion: nil)
  }

  // MARK: Surahs

  private func surahSections(_ s: CarSnapshot) -> [CPListSection] {
    // One section per juz (each surah under the juz it starts in), so the
    // list doubles as the Juz view.
    let byId = Dictionary(uniqueKeysWithValues: s.surahs.map { ($0.id, $0) })
    return s.juz.map { juz in
      CPListSection(items: juz.surahIds.compactMap { byId[$0] }.map(surahRow), header: "Juz \(juz.number)", sectionIndexTitle: "\(juz.number)")
    }
  }

  private func surahRow(_ surah: CarSurah) -> CPListItem {
    let image = CarArtworkCache.shared.image(for: .surah(surah.id), style: style()) { [weak self] _ in self?.refreshSoon() }
    let item = CPListItem(text: "\(surah.id). \(surah.name)", detailText: surah.translation, image: image)
    item.accessoryType = .disclosureIndicator
    item.handler = { [weak self] _, completion in
      self?.pushSurahReciters(surah.id)
      completion()
    }
    return item
  }

  private func pushSurahReciters(_ surahId: Int) {
    guard let s = CarBridge.shared.snapshot, let surah = s.surahs.first(where: { $0.id == surahId }) else { return }
    var items: [CPListItem] = []
    if let topId = s.topReciterId,
       let top = s.reciters.first(where: { $0.id == topId }),
       let rewayah = top.rewayat.first(where: { $0.surahIds.contains(surahId) }) {
      let play = CPListItem(text: "Play with \(top.name)", detailText: rewayah.name, image: UIImage(systemName: "play.circle.fill"))
      play.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": top.id, "rewayatId": rewayah.id, "surahId": surahId])
        completion()
      }
      items.append(play)
    }
    let choices = s.reciters.compactMap { r -> CPListItem? in
      guard let rewayah = r.rewayat.first(where: { $0.surahIds.contains(surahId) }) else { return nil }
      let image = CarArtworkCache.shared.image(for: r.artwork, style: style()) { [weak self] _ in self?.refreshSoon() }
      let item = CPListItem(text: r.name, detailText: r.rewayat.count > 1 ? rewayah.name : nil, image: image)
      item.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": r.id, "rewayatId": rewayah.id, "surahId": surahId])
        completion()
      }
      return item
    }
    let maxChoices = CPListTemplate.maximumItemCount - items.count
    let sections = [
      CPListSection(items: items),
      CPListSection(items: Array(choices.prefix(max(maxChoices, 0))), header: "Choose reciter", sectionIndexTitle: nil),
    ]
    interfaceController?.pushTemplate(CPListTemplate(title: surah.name, sections: sections), animated: true, completion: nil)
  }

  // MARK: Image refresh coalescing

  private var refreshScheduled = false
  private func refreshSoon() {
    guard !refreshScheduled else { return }
    refreshScheduled = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
      self?.refreshScheduled = false
      self?.refresh()
    }
  }
}
```

Known limit: pushed (non-root) templates keep the placeholder image until re-opened. Acceptable for v1; the root tabs refresh.

- [ ] **Step 3: Replace `CarPlaySceneDelegate.swift`**

```swift
import CarPlay
import UIKit

@objc(CarPlaySceneDelegate)
public final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  private var builder: CarTemplateBuilder?
  private var nowPlaying: CarNowPlayingController?
  private var observers: [NSObjectProtocol] = []

  public func templateApplicationScene(
    _ scene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    BayaanCarSceneBridge.shared.ensureStarted()
    self.interfaceController = interfaceController
    let builder = CarTemplateBuilder(interfaceController: interfaceController) {
      scene.carWindow.traitCollection.userInterfaceStyle
    }
    self.builder = builder
    nowPlaying = CarNowPlayingController(interfaceController: interfaceController)
    let tabBar = CPTabBarTemplate(templates: builder.tabTemplates())
    interfaceController.setRootTemplate(tabBar, animated: false, completion: nil)
    observers.append(NotificationCenter.default.addObserver(forName: CarBridge.snapshotDidChange, object: nil, queue: .main) { [weak self] _ in
      self?.builder?.refresh()
    })
    CarBridge.shared.setConnected(true)
  }

  public func templateApplicationScene(
    _ scene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    observers.forEach(NotificationCenter.default.removeObserver)
    observers.removeAll()
    nowPlaying?.tearDown()
    nowPlaying = nil
    builder = nil
    self.interfaceController = nil
    CarBridge.shared.setConnected(false)
  }
}
```

`CarNowPlayingController` arrives in Task 8. To build this task alone, add a temporary stub in `CarNowPlaying.swift`:
```swift
import CarPlay
final class CarNowPlayingController {
  init(interfaceController: CPInterfaceController) {}
  func tearDown() {}
}
```

- [ ] **Step 4: Build and verify in the CarPlay Simulator**

Build (command from Task 1 Step 6). Run the app, open the CarPlay Simulator. Check:
1. Four tabs: Home, Library, Reciters, Surahs, with icons.
2. Home shows Quick start, then sections that match the phone's data (play a surah on the phone first; it appears in Jump back in with a progress bar).
3. Reciters: favorites section first; tapping a single-rewayah reciter goes straight to surahs; a multi-rewayah reciter shows the picker.
4. Surahs: grouped by "Juz N" sections with a juz index; tapping Al-Kahf shows "Play with <top reciter>" and "Choose reciter".
5. Tapping a surah starts playback on the phone and opens Now Playing.
6. Artwork: surah cards replace numbered placeholders within a second or two; airplane mode after one load still shows them.
7. Kill the app; launch Bayaan from CarPlay; tap a surah; playback starts after JS boots (pending queue).
8. Toggle car appearance (CarPlay Simulator > Appearance) and reconnect: light surah cards appear.

- [ ] **Step 5: Commit**

```bash
git add modules/bayaan-car/ios
git commit -m "feat(carplay): tabs, home shelves, reciters and surahs templates"
```

---

### Task 8: CarPlay Now Playing, transport, and lock-screen car mode

**Files:**
- Modify: `modules/bayaan-car/ios/CarNowPlaying.swift` (replace stub)
- Modify: `services/audio/LockScreenService.ts` (car mode)
- Modify: `services/car/CarPlaybackBridge.ts` (call car mode on connection)

**Interfaces:**
- Consumes: `CarBridge` (Task 6), `CarTemplateBuilder` push helpers are not needed; Up Next builds its own list.
- Produces: `lockScreenService.setCarMode(enabled: boolean): void`.

- [ ] **Step 1: `CarNowPlaying.swift`**

```swift
import CarPlay
import MediaPlayer

final class CarNowPlayingController: NSObject, CPNowPlayingTemplateObserver {
  private weak var interfaceController: CPInterfaceController?
  private var observer: NSObjectProtocol?
  private let commands = MPRemoteCommandCenter.shared()

  init(interfaceController: CPInterfaceController) {
    self.interfaceController = interfaceController
    super.init()
    let template = CPNowPlayingTemplate.shared
    template.add(self)
    template.isUpNextButtonEnabled = true
    template.isAlbumArtistButtonEnabled = true
    template.upNextTitle = "Up Next"
    commands.nextTrackCommand.isEnabled = true
    commands.previousTrackCommand.isEnabled = true
    commands.nextTrackCommand.addTarget(self, action: #selector(onNext))
    commands.previousTrackCommand.addTarget(self, action: #selector(onPrevious))
    observer = NotificationCenter.default.addObserver(forName: CarBridge.nowPlayingDidChange, object: nil, queue: .main) { [weak self] _ in
      self?.updateButtons()
    }
    updateButtons()
  }

  func tearDown() {
    CPNowPlayingTemplate.shared.remove(self)
    commands.nextTrackCommand.removeTarget(self)
    commands.previousTrackCommand.removeTarget(self)
    commands.nextTrackCommand.isEnabled = false
    commands.previousTrackCommand.isEnabled = false
    if let observer { NotificationCenter.default.removeObserver(observer) }
  }

  @objc private func onNext(_ event: MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus {
    CarBridge.shared.send(transport: ["kind": "next"])
    return .success
  }

  @objc private func onPrevious(_ event: MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus {
    CarBridge.shared.send(transport: ["kind": "previous"])
    return .success
  }

  private func updateButtons() {
    let np = CarBridge.shared.nowPlaying
    let rate = CPNowPlayingPlaybackRateButton { _ in
      CarBridge.shared.send(transport: ["kind": "cycleRate"])
    }
    let repeatButton = CPNowPlayingRepeatButton { _ in
      CarBridge.shared.send(transport: ["kind": "cycleRepeat"])
    }
    let loveImage = UIImage(systemName: np?.isLoved == true ? "heart.fill" : "heart") ?? UIImage()
    let love = CPNowPlayingImageButton(image: loveImage) { _ in
      CarBridge.shared.send(transport: ["kind": "toggleLove"])
    }
    CPNowPlayingTemplate.shared.updateNowPlayingButtons([rate, repeatButton, love])
    switch np?.repeatMode {
    case "track": commands.changeRepeatModeCommand.currentRepeatType = .one
    case "queue": commands.changeRepeatModeCommand.currentRepeatType = .all
    default: commands.changeRepeatModeCommand.currentRepeatType = .off
    }
  }

  // MARK: CPNowPlayingTemplateObserver

  func nowPlayingTemplateUpNextButtonTapped(_ nowPlayingTemplate: CPNowPlayingTemplate) {
    guard let np = CarBridge.shared.nowPlaying else { return }
    let items = np.queue.enumerated().map { index, entry -> CPListItem in
      let image = entry.surahId.map { CarArtworkCache.shared.image(for: .surah($0), style: .dark) { _ in } }
      let item = CPListItem(text: entry.title, detailText: entry.subtitle, image: image)
      item.isPlaying = index == np.currentIndex
      item.handler = { _, completion in
        CarBridge.shared.send(transport: ["kind": "jumpTo", "index": index])
        completion()
      }
      return item
    }
    let limited = Array(items.prefix(CPListTemplate.maximumItemCount))
    interfaceController?.pushTemplate(CPListTemplate(title: "Up Next", sections: [CPListSection(items: limited)]), animated: true, completion: nil)
  }

  func nowPlayingTemplateAlbumArtistButtonTapped(_ nowPlayingTemplate: CPNowPlayingTemplate) {
    guard let reciterId = CarBridge.shared.nowPlaying?.reciterId,
          let reciter = CarBridge.shared.snapshot?.reciters.first(where: { $0.id == reciterId }) else { return }
    let items = reciter.rewayat.flatMap { w in
      w.surahIds.prefix(20).map { sid -> CPListItem in
        let name = CarBridge.shared.snapshot?.surahs.first(where: { $0.id == sid })?.name ?? "Surah \(sid)"
        let item = CPListItem(text: "\(sid). \(name)", detailText: reciter.rewayat.count > 1 ? w.name : nil)
        item.handler = { _, completion in
          CarBridge.shared.send(play: ["kind": "surah", "reciterId": reciter.id, "rewayatId": w.id, "surahId": sid])
          completion()
        }
        return item
      }
    }
    interfaceController?.pushTemplate(CPListTemplate(title: reciter.name, sections: [CPListSection(items: items)]), animated: true, completion: nil)
  }
}
```

- [ ] **Step 2: Lock-screen car mode**

In `services/audio/LockScreenService.ts`, add a private field `private carMode = false;` and a public method:
```ts
  /**
   * While a car is connected, hide the 10s skip buttons so CarPlay shows
   * previous / next surah instead. Restored on disconnect.
   */
  setCarMode(enabled: boolean): void {
    if (this.carMode === enabled) return;
    this.carMode = enabled;
    const track = usePlayerStore.getState().queue.tracks[usePlayerStore.getState().queue.currentIndex];
    if (track) this.activateMainPlayer(track);
  }
```
and in `activateMainPlayer`, change the options to:
```ts
      player.setActiveForLockScreen(true, metadata, {
        showSeekForward: !this.carMode,
        showSeekBackward: !this.carMode,
      });
```
Read the class first to confirm the exported instance name (likely `lockScreenService`) and that `activateMainPlayer` is the only place that sets these flags for the main player.

In `services/car/CarPlaybackBridge.ts` `startCarPlaybackBridge`, add to `unsubscribers`:
```ts
    BayaanCar.addConnectionListener(connected => lockScreenService.setCarMode(connected)),
```
with `import {lockScreenService} from '@/services/audio/LockScreenService';`.

- [ ] **Step 3: Build and verify in the CarPlay Simulator**

1. Now Playing shows previous / next surah buttons (not 10s skip) while connected; tapping next advances the phone's queue.
2. Speed button cycles 1x, 1.25x, 1.5x, 0.75x; phone player reflects it.
3. Repeat button cycles and the icon state follows.
4. Heart toggles loved; the phone's loved list updates; icon flips.
5. Up Next lists the queue with the current item marked; tapping jumps.
6. Reciter (album artist) button opens that reciter's surahs.
7. Disconnect CarPlay: phone lock screen shows 10s skip buttons again.

- [ ] **Step 4: Typecheck, format, commit**

```bash
npx tsc --noEmit && npx prettier --write services/audio/LockScreenService.ts services/car/CarPlaybackBridge.ts
git add modules/bayaan-car/ios/CarNowPlaying.swift services/audio/LockScreenService.ts services/car/CarPlaybackBridge.ts
git commit -m "feat(carplay): now playing buttons, up next and surah skipping"
```

---

### Task 9: Android Auto browse tree, forwarding player and search

**Files:**
- Create: `.../CarForwardingPlayer.kt`, `.../CarBrowseTree.kt`, `.../CarSearch.kt`
- Modify: `.../BayaanLibraryService.kt` (replace hello)

**Interfaces:**
- Consumes: `CarBridge`, `CarSnapshot` (Task 6); `CarArtworkProvider.uriFor(context, artwork): Uri` (Task 10; until then use `Uri.EMPTY` via a stub `object CarArtworkProvider { fun uriFor(context: Context, artwork: CarArtwork): Uri? = null }` in `CarArtworkProvider.kt`).
- Produces: media ids. Root `"root"`; tabs `"tab:home"`, `"tab:library"`, `"tab:reciters"`, `"tab:surahs"`; browse `"list:<id>"`, `"reciter:<id>"`, `"rewayah:<reciterId>:<rewayatId>"`, `"surah:<id>"` (choose reciter); playable ids are `"play:<base64 of request json>"`.

- [ ] **Step 1: `CarForwardingPlayer.kt`**

```kotlin
package expo.modules.bayaancar

import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

/**
 * Mirrors expo-audio's state (pushed from JS) and forwards every command to
 * JS. It never plays audio itself.
 */
@UnstableApi
class CarForwardingPlayer(looper: Looper) : SimpleBasePlayer(looper) {
  private val listener: () -> Unit = { invalidateState() }

  init {
    CarBridge.onNowPlayingChanged.add(listener)
  }

  fun detach() {
    CarBridge.onNowPlayingChanged.remove(listener)
  }

  override fun getState(): State {
    val np = CarBridge.nowPlaying
    val commands = Player.Commands.Builder().addAll(
      Player.COMMAND_PLAY_PAUSE,
      Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_NEXT,
      Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_PREVIOUS,
      Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_MEDIA_ITEM,
      Player.COMMAND_SET_SPEED_AND_PITCH,
      Player.COMMAND_SET_REPEAT_MODE,
      Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
      Player.COMMAND_GET_TIMELINE,
      Player.COMMAND_GET_METADATA,
      Player.COMMAND_SET_MEDIA_ITEM,
    ).build()
    if (np == null || np.queue.isEmpty()) {
      return State.Builder().setAvailableCommands(commands).setPlaybackState(Player.STATE_IDLE).build()
    }
    val playlist = np.queue.mapIndexed { index, entry ->
      val metadata = MediaMetadata.Builder()
        .setTitle(entry.title)
        .setArtist(entry.subtitle)
        .apply { entry.surahId?.let { setArtworkUri(CarArtworkProvider.uriFor(CarArtwork.Surah(it))) } }
        .build()
      val item = MediaItem.Builder().setMediaId("queue:$index").setMediaMetadata(metadata).build()
      val builder = MediaItemData.Builder("queue:$index").setMediaItem(item)
      if (index == np.currentIndex && np.durationSec > 0) builder.setDurationUs((np.durationSec * 1_000_000).toLong())
      builder.build()
    }
    val positionMs = (np.positionSec * 1000).toLong()
    // getState() can run later than the JS push, so advance by the time since.
    val nowMs = android.os.SystemClock.elapsedRealtime()
    val livePositionMs = if (np.isPlaying) positionMs + ((nowMs - np.receivedAtMs) * np.rate).toLong() else positionMs
    return State.Builder()
      .setAvailableCommands(commands)
      .setPlaylist(playlist)
      .setCurrentMediaItemIndex(np.currentIndex.coerceIn(0, playlist.size - 1))
      .setPlaybackState(Player.STATE_READY)
      .setPlayWhenReady(np.isPlaying, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
      .setPlaybackParameters(PlaybackParameters(np.rate.toFloat()))
      .setRepeatMode(
        when (np.repeatMode) {
          "track" -> Player.REPEAT_MODE_ONE
          "queue" -> Player.REPEAT_MODE_ALL
          else -> Player.REPEAT_MODE_OFF
        },
      )
      .setContentPositionMs(
        if (np.isPlaying) PositionSupplier.getExtrapolating(livePositionMs, np.rate.toFloat())
        else PositionSupplier.getConstant(positionMs),
      )
      .build()
  }

  private fun transport(kind: String, extra: (JSONObject) -> Unit = {}): ListenableFuture<*> {
    val o = JSONObject().put("kind", kind)
    extra(o)
    CarBridge.sendTransport(o.toString())
    return Futures.immediateVoidFuture()
  }

  override fun handleSetPlayWhenReady(playWhenReady: Boolean) = transport(if (playWhenReady) "play" else "pause")

  override fun handleSeek(mediaItemIndex: Int, positionMs: Long, seekCommand: Int): ListenableFuture<*> = when (seekCommand) {
    Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> transport("next")
    Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> transport("previous")
    Player.COMMAND_SEEK_TO_MEDIA_ITEM -> transport("jumpTo") { it.put("index", mediaItemIndex) }
    else -> transport("seek") { it.put("position", positionMs / 1000.0) }
  }

  override fun handleSetPlaybackParameters(playbackParameters: PlaybackParameters) =
    transport("rate") { it.put("value", playbackParameters.speed.toDouble()) }

  override fun handleSetRepeatMode(repeatMode: Int) = transport("cycleRepeat")
}
```

- [ ] **Step 2: `CarBrowseTree.kt`**

```kotlin
package expo.modules.bayaancar

import android.os.Bundle
import android.util.Base64
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.session.MediaConstants
import org.json.JSONObject

object CarBrowseTree {
  private const val DOWNLOAD_STATUS = "android.media.extra.DOWNLOAD_STATUS"
  private const val STATUS_DOWNLOADED = 2L

  val tabs = listOf("tab:home" to "Home", "tab:library" to "Library", "tab:reciters" to "Reciters", "tab:surahs" to "Surahs")

  fun playId(requestJson: String): String =
    "play:" + Base64.encodeToString(requestJson.toByteArray(), Base64.NO_WRAP or Base64.URL_SAFE)

  fun requestFromPlayId(mediaId: String): String? {
    if (!mediaId.startsWith("play:")) return null
    return runCatching { String(Base64.decode(mediaId.removePrefix("play:"), Base64.NO_WRAP or Base64.URL_SAFE)) }.getOrNull()
  }

  fun surahRequest(reciterId: String, rewayatId: String, surahId: Int): String =
    JSONObject().put("kind", "surah").put("reciterId", reciterId).put("rewayatId", rewayatId).put("surahId", surahId).toString()

  fun root(): MediaItem = browsable("root", "Bayaan", null, null)

  fun children(parentId: String): List<MediaItem> {
    val s = CarBridge.snapshot ?: return listOf(message("Open Bayaan on your phone to get started"))
    return when {
      parentId == "root" -> tabs.map { (id, title) -> browsable(id, title, null, gridStyle(id != "tab:surahs")) }
      parentId == "tab:home" -> home(s)
      parentId == "tab:library" -> s.library.map { item(it, null) }
      parentId == "tab:reciters" -> s.reciters.map { reciter(it, if (it.isFavorite) "Favorites" else "All reciters") }
      parentId == "tab:surahs" -> s.juz.flatMap { juz ->
        juz.surahIds.mapNotNull { id -> s.surahs.firstOrNull { it.id == id } }.map { surahBrowse(it, "Juz ${juz.number}") }
      }
      parentId.startsWith("list:") -> s.lists[parentId.removePrefix("list:")]?.items?.map { item(it, null) }.orEmpty()
        .ifEmpty { listOf(message("Nothing here yet")) }
      parentId.startsWith("reciter:") -> reciterChildren(s, parentId.removePrefix("reciter:"))
      parentId.startsWith("rewayah:") -> {
        val (reciterId, rewayatId) = parentId.removePrefix("rewayah:").split(":", limit = 2).let { it[0] to it.getOrElse(1) { "" } }
        rewayahSurahs(s, reciterId, rewayatId)
      }
      parentId.startsWith("surah:") -> surahReciters(s, parentId.removePrefix("surah:").toIntOrNull() ?: 0)
      else -> emptyList()
    }
  }

  private fun home(s: CarSnapshot): List<MediaItem> {
    val out = mutableListOf<MediaItem>()
    s.quickStart.forEach { out.add(item(it, "Quick start")) }
    s.sections.forEach { section -> section.items.forEach { out.add(item(it, section.title)) } }
    return out
  }

  private fun reciterChildren(s: CarSnapshot, reciterId: String): List<MediaItem> {
    val r = s.reciters.firstOrNull { it.id == reciterId } ?: return emptyList()
    if (r.rewayat.size == 1) return rewayahSurahs(s, r.id, r.rewayat[0].id)
    return r.rewayat.map { w -> browsable("rewayah:${r.id}:${w.id}", w.name, "${w.surahIds.size} surahs", null) }
  }

  private fun rewayahSurahs(s: CarSnapshot, reciterId: String, rewayatId: String): List<MediaItem> {
    val r = s.reciters.firstOrNull { it.id == reciterId } ?: return emptyList()
    val w = r.rewayat.firstOrNull { it.id == rewayatId } ?: return emptyList()
    return w.surahIds.mapNotNull { sid ->
      val surah = s.surahs.firstOrNull { it.id == sid } ?: return@mapNotNull null
      val extras = Bundle()
      if (s.downloadedKeys.contains("${r.id}:${w.id}:$sid")) extras.putLong(DOWNLOAD_STATUS, STATUS_DOWNLOADED)
      playable(playId(surahRequest(r.id, w.id, sid)), "$sid. ${surah.name}", surah.translation, CarArtwork.Surah(sid), extras)
    }
  }

  private fun surahReciters(s: CarSnapshot, surahId: Int): List<MediaItem> {
    val surah = s.surahs.firstOrNull { it.id == surahId } ?: return emptyList()
    val out = mutableListOf<MediaItem>()
    val top = s.reciters.firstOrNull { it.id == s.topReciterId }
    top?.rewayat?.firstOrNull { it.surahIds.contains(surahId) }?.let { w ->
      out.add(playable(playId(surahRequest(top.id, w.id, surahId)), "Play with ${top.name}", surah.name, CarArtwork.Surah(surahId), groupTitle(surah.name)))
    }
    s.reciters.forEach { r ->
      val w = r.rewayat.firstOrNull { it.surahIds.contains(surahId) } ?: return@forEach
      out.add(playable(playId(surahRequest(r.id, w.id, surahId)), r.name, if (r.rewayat.size > 1) w.name else null, r.artwork, groupTitle("Choose reciter")))
    }
    return out
  }

  private fun surahBrowse(surah: CarSurah, group: String): MediaItem =
    browsable("surah:${surah.id}", "${surah.id}. ${surah.name}", surah.translation, groupTitle(group), CarArtwork.Surah(surah.id))

  private fun reciter(r: CarReciter, group: String): MediaItem =
    browsable("reciter:${r.id}", r.name, if (r.rewayat.size > 1) "${r.rewayat.size} rewayat" else null, groupTitle(group), r.artwork)

  private fun item(i: CarItem, group: String?): MediaItem {
    val extras = group?.let { groupTitle(it) } ?: Bundle()
    i.progress?.let {
      extras.putInt(MediaConstants.EXTRAS_KEY_COMPLETION_STATUS, MediaConstants.EXTRAS_VALUE_COMPLETION_STATUS_PARTIALLY_PLAYED)
      extras.putDouble(MediaConstants.EXTRAS_KEY_COMPLETION_PERCENTAGE, it)
    }
    if (i.isDownloaded) extras.putLong(DOWNLOAD_STATUS, STATUS_DOWNLOADED)
    return when (val a = i.action) {
      is CarItemAction.Play -> playable(playId(a.requestJson), i.title, i.subtitle, i.artwork, extras)
      is CarItemAction.BrowseList -> browsable("list:${a.listId}", i.title, i.subtitle, extras, i.artwork)
      is CarItemAction.BrowseReciter -> browsable("reciter:${a.reciterId}", i.title, i.subtitle, extras, i.artwork)
      is CarItemAction.BrowseSurahReciters -> browsable("surah:${a.surahId}", i.title, i.subtitle, extras, i.artwork)
    }
  }

  private fun groupTitle(title: String) = Bundle().apply { putString(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_GROUP_TITLE, title) }

  private fun gridStyle(grid: Boolean) = Bundle().apply {
    val style = if (grid) MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_GRID_ITEM else MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_LIST_ITEM
    putInt(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_BROWSABLE, style)
    putInt(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_PLAYABLE, MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_LIST_ITEM)
  }

  private fun message(text: String): MediaItem = MediaItem.Builder().setMediaId("message").setMediaMetadata(
    MediaMetadata.Builder().setTitle(text).setIsBrowsable(false).setIsPlayable(false).build(),
  ).build()

  private fun browsable(id: String, title: String, subtitle: String?, extras: Bundle?, artwork: CarArtwork? = null): MediaItem =
    MediaItem.Builder().setMediaId(id).setMediaMetadata(
      MediaMetadata.Builder()
        .setTitle(title)
        .setSubtitle(subtitle)
        .setIsBrowsable(true)
        .setIsPlayable(false)
        .setExtras(extras)
        .apply { artwork?.let { setArtworkUri(CarArtworkProvider.uriFor(it)) } }
        .build(),
    ).build()

  private fun playable(id: String, title: String, subtitle: String?, artwork: CarArtwork, extras: Bundle): MediaItem =
    MediaItem.Builder().setMediaId(id).setMediaMetadata(
      MediaMetadata.Builder()
        .setTitle(title)
        .setSubtitle(subtitle)
        .setIsBrowsable(false)
        .setIsPlayable(true)
        .setExtras(extras)
        .setArtworkUri(CarArtworkProvider.uriFor(artwork))
        .build(),
    ).build()
}
```

Temporary `CarArtworkProvider.kt` until Task 10:
```kotlin
package expo.modules.bayaancar

import android.net.Uri

object CarArtworkProvider {
  fun uriFor(artwork: CarArtwork): Uri? = null
}
```

- [ ] **Step 3: `CarSearch.kt`**

```kotlin
package expo.modules.bayaancar

import java.text.Normalizer

object CarSearch {
  private fun norm(s: String): String = Normalizer.normalize(s, Normalizer.Form.NFD)
    .replace(Regex("\\p{Mn}+"), "")
    .lowercase()
    .replace(Regex("^(surah|sura|surat)\\s+"), "")
    .replace(Regex("^(al|an|ar|as|at|ad|adh|ash|az)[-\\s]"), "")
    .replace(Regex("[^\\p{L}\\p{N}]+"), "")

  /** "al kahf by mishary" -> (surah, reciter?) request JSON strings, best first. */
  fun search(query: String): List<String> {
    val s = CarBridge.snapshot ?: return emptyList()
    val parts = query.split(Regex("\\s+(by|with)\\s+", RegexOption.IGNORE_CASE), limit = 2)
    val surahQuery = norm(parts[0])
    val reciterQuery = parts.getOrNull(1)?.let { norm(it) }
    if (surahQuery.isEmpty()) return emptyList()

    val surahs = s.surahs.filter {
      val n = norm(it.name)
      n == surahQuery || n.startsWith(surahQuery) || norm(it.nameArabic) == surahQuery || it.id.toString() == surahQuery
    }.sortedBy { if (norm(it.name) == surahQuery) 0 else 1 }

    val reciters = when (reciterQuery) {
      null -> listOfNotNull(s.reciters.firstOrNull { it.id == s.topReciterId }) + s.reciters.filter { it.isFavorite }
      else -> s.reciters.filter { norm(it.name).contains(reciterQuery) }
    }.distinctBy { it.id }

    val out = mutableListOf<String>()
    for (surah in surahs) {
      for (r in reciters) {
        val w = r.rewayat.firstOrNull { it.surahIds.contains(surah.id) } ?: continue
        out.add(CarBrowseTree.surahRequest(r.id, w.id, surah.id))
        if (out.size >= 10) return out
      }
    }
    return out
  }
}
```

- [ ] **Step 4: Replace `BayaanLibraryService.kt`**

```kotlin
package expo.modules.bayaancar

import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.facebook.react.ReactApplication
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

@UnstableApi
class BayaanLibraryService : MediaLibraryService() {
  private var session: MediaLibrarySession? = null
  private var player: CarForwardingPlayer? = null
  private val rateCommand = SessionCommand("bayaan.cycleRate", Bundle.EMPTY)
  private val loveCommand = SessionCommand("bayaan.toggleLove", Bundle.EMPTY)
  private val repeatCommand = SessionCommand("bayaan.cycleRepeat", Bundle.EMPTY)
  private val snapshotListener: () -> Unit = { session?.notifyChildrenChanged("root", 4, null) }
  private val nowPlayingListener: () -> Unit = { session?.setMediaButtonPreferences(buttons()) }

  override fun onCreate() {
    super.onCreate()
    CarBridge.init(applicationContext)
    val p = CarForwardingPlayer(mainLooper)
    player = p
    session = MediaLibrarySession.Builder(this, p, Callback())
      .setId("bayaan-car")
      .setMediaButtonPreferences(buttons())
      .build()
    CarBridge.onSnapshotChanged.add(snapshotListener)
    CarBridge.onNowPlayingChanged.add(nowPlayingListener)
  }

  private fun buttons(): ImmutableList<CommandButton> {
    val loved = CarBridge.nowPlaying?.isLoved == true
    val repeatIcon = when (CarBridge.nowPlaying?.repeatMode) {
      "track" -> CommandButton.ICON_REPEAT_ONE
      "queue" -> CommandButton.ICON_REPEAT_ALL
      else -> CommandButton.ICON_REPEAT_OFF
    }
    return ImmutableList.of(
      CommandButton.Builder(CommandButton.ICON_PLAYBACK_SPEED).setDisplayName("Speed").setSessionCommand(rateCommand).build(),
      CommandButton.Builder(repeatIcon).setDisplayName("Repeat").setSessionCommand(repeatCommand).build(),
      CommandButton.Builder(if (loved) CommandButton.ICON_HEART_FILLED else CommandButton.ICON_HEART_UNFILLED)
        .setDisplayName("Love").setSessionCommand(loveCommand).build(),
    )
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = session

  // expo-audio's AudioControlsService owns the phone notification and foreground state.
  override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) = Unit

  override fun onDestroy() {
    CarBridge.onSnapshotChanged.remove(snapshotListener)
    CarBridge.onNowPlayingChanged.remove(nowPlayingListener)
    CarBridge.setConnected(false)
    player?.detach()
    session?.release()
    session = null
    player = null
    super.onDestroy()
  }

  private fun ensureJs() {
    (application as? ReactApplication)?.reactHost?.start()
  }

  private inner class Callback : MediaLibrarySession.Callback {
    override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult {
      if (session.isAutoCompanionController(controller) || session.isAutomotiveController(controller)) {
        CarBridge.setConnected(true)
        ensureJs()
      }
      val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
        .add(rateCommand)
        .add(loveCommand)
        .add(repeatCommand)
        .build()
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session).setAvailableSessionCommands(commands).build()
    }

    override fun onDisconnected(session: MediaSession, controller: MediaSession.ControllerInfo) {
      if (session.isAutoCompanionController(controller) || session.isAutomotiveController(controller)) {
        CarBridge.setConnected(false)
      }
    }

    override fun onCustomCommand(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
      customCommand: SessionCommand,
      args: Bundle,
    ): ListenableFuture<SessionResult> {
      when (customCommand.customAction) {
        rateCommand.customAction -> CarBridge.sendTransport("{\"kind\":\"cycleRate\"}")
        loveCommand.customAction -> CarBridge.sendTransport("{\"kind\":\"toggleLove\"}")
        repeatCommand.customAction -> CarBridge.sendTransport("{\"kind\":\"cycleRepeat\"}")
      }
      return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
    }

    override fun onGetLibraryRoot(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<MediaItem>> =
      Futures.immediateFuture(LibraryResult.ofItem(CarBrowseTree.root(), params))

    override fun onGetChildren(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> =
      Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(CarBrowseTree.children(parentId)), params))

    override fun onSetMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
      startIndex: Int,
      startPositionMs: Long,
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      ensureJs()
      val chosen = mediaItems.getOrNull(maxOf(startIndex, 0)) ?: mediaItems.firstOrNull()
      val request = chosen?.let { item ->
        CarBrowseTree.requestFromPlayId(item.mediaId)
          ?: item.requestMetadata.searchQuery?.let { CarSearch.search(it).firstOrNull() }
      }
      request?.let { CarBridge.sendPlay(it) }
      // Keep the forwarding player's own playlist; JS will push the real queue.
      return Futures.immediateFuture(MediaSession.MediaItemsWithStartPosition(ImmutableList.of(), 0, 0))
    }

    override fun onSearch(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      query: String,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<Void>> {
      session.notifySearchResultChanged(browser, query, CarSearch.search(query).size, params)
      return Futures.immediateFuture(LibraryResult.ofVoid())
    }

    override fun onGetSearchResult(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      query: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
      val s = CarBridge.snapshot
      val items = CarSearch.search(query).mapNotNull { json ->
        val o = org.json.JSONObject(json)
        val surah = s?.surahs?.firstOrNull { it.id == o.getInt("surahId") } ?: return@mapNotNull null
        val reciter = s.reciters.firstOrNull { it.id == o.getString("reciterId") } ?: return@mapNotNull null
        MediaItem.Builder().setMediaId(CarBrowseTree.playId(json)).setMediaMetadata(
          androidx.media3.common.MediaMetadata.Builder()
            .setTitle(surah.name).setSubtitle(reciter.name)
            .setIsBrowsable(false).setIsPlayable(true)
            .setArtworkUri(CarArtworkProvider.uriFor(CarArtwork.Surah(surah.id)))
            .build(),
        ).build()
      }
      return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(items), params))
    }
  }
}
```

Verify these Media3 1.9 names compile; if `isAutoCompanionController` or `setMediaButtonPreferences` differ, check `androidx.media3.session.MediaSession` in Android Studio and use the 1.9 equivalent (`setCustomLayout` is the older name for button preferences).

- [ ] **Step 5: Build and verify with the DHU**

Build (Task 2 Step 4). Check on the DHU:
1. Four tabs; Home and Library are grids, Surahs is a list; Home items are grouped under "Quick start", "For right now", "Jump back in", and so on.
2. Recently played items show a partial-progress indicator; downloaded surahs show the downloaded badge.
3. Tapping an item plays on the phone; the DHU player shows title, reciter, artwork placeholder, progress moving, next / previous working.
4. Speed, repeat and heart buttons appear and work; repeat and heart icons follow state.
4b. Surahs tab is grouped under "Juz 1", "Juz 2", and so on.
5. Pause from the phone: the DHU shows paused within a second.
6. Voice: in the DHU, "Play Al-Kahf by Mishary on Bayaan" (or type the query in the DHU search) plays the right recitation.
7. Force-stop the app, open Bayaan from the DHU, tap a surah: plays after JS boots.
8. Exactly one media notification on the phone throughout.

- [ ] **Step 6: Commit**

```bash
git add modules/bayaan-car/android
git commit -m "feat(android-auto): browse tree, forwarding player and voice search"
```

---

### Task 10: Android artwork provider

**Files:**
- Modify: `modules/bayaan-car/android/src/main/java/expo/modules/bayaancar/CarArtworkProvider.kt` (replace stub)
- Modify: `modules/bayaan-car/android/src/main/AndroidManifest.xml` (provider)

**Interfaces:**
- Produces: `CarArtworkProvider.uriFor(artwork: CarArtwork): Uri?` returning `content://<packageName>.bayaancar.artwork/<key>`; the provider downloads, downscales to 256 px and caches in `cacheDir/bayaan-car/artwork`.

- [ ] **Step 1: Manifest**

Add inside `<application>`:
```xml
    <provider
      android:name="expo.modules.bayaancar.CarArtworkProvider"
      android:authorities="${applicationId}.bayaancar.artwork"
      android:exported="true"
      tools:ignore="ExportedContentProvider" />
```
and add `xmlns:tools="http://schemas.android.com/tools"` to the `<manifest>` element. Android Auto reads artwork from another process, so the provider is exported and read-only (it serves only cached images).

- [ ] **Step 2: `CarArtworkProvider.kt`**

```kotlin
package expo.modules.bayaancar

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Base64
import java.io.File
import java.io.FileOutputStream
import java.net.URL

class CarArtworkProvider : ContentProvider() {
  companion object {
    private const val SIZE = 256
    private const val SURAH_BASE = "https://cdn.thebayaan.com/assets/og-images/surah/"
    private var authority: String? = null

    fun uriFor(artwork: CarArtwork): Uri? {
      val auth = authority ?: return null
      val key = when (artwork) {
        is CarArtwork.Surah -> "surah-${artwork.surahId}"
        is CarArtwork.Url -> "url-" + encode(artwork.url)
        is CarArtwork.Asset -> "asset-" + encode(artwork.uri)
        is CarArtwork.Monogram -> "tile-" + encode("${artwork.label}|${artwork.hex}")
        is CarArtwork.Color -> "tile-" + encode("${artwork.label}|${artwork.hex}")
      }
      return Uri.parse("content://$auth/$key")
    }

    private fun encode(s: String) = Base64.encodeToString(s.toByteArray(), Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)
    private fun decode(s: String) = String(Base64.decode(s, Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING))
  }

  override fun onCreate(): Boolean {
    authority = "${context?.packageName}.bayaancar.artwork"
    return true
  }

  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? {
    val ctx = context ?: return null
    val key = uri.lastPathSegment ?: return null
    val dir = File(ctx.cacheDir, "bayaan-car/artwork").apply { mkdirs() }
    val file = File(dir, "$key.png")
    if (!file.exists()) {
      val bitmap = render(key) ?: return null
      FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
    return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
  }

  private fun render(key: String): Bitmap? = when {
    key.startsWith("surah-") -> download("$SURAH_BASE${key.removePrefix("surah-")}.png")
    key.startsWith("url-") -> download(decode(key.removePrefix("url-")))
    key.startsWith("asset-") -> asset(decode(key.removePrefix("asset-")))
    key.startsWith("tile-") -> decode(key.removePrefix("tile-")).split("|", limit = 2).let { tile(it[0], it.getOrElse(1) { "#333333" }) }
    else -> null
  }

  private fun download(url: String): Bitmap? = runCatching {
    URL(url).openStream().use { BitmapFactory.decodeStream(it) }?.let { Bitmap.createScaledBitmap(it, SIZE, SIZE, true) }
  }.getOrNull()

  private fun asset(uri: String): Bitmap? {
    if (uri.startsWith("http")) return download(uri)
    val ctx = context ?: return null
    val id = ctx.resources.getIdentifier(uri, "drawable", ctx.packageName)
    if (id == 0) return null
    return BitmapFactory.decodeResource(ctx.resources, id)?.let { Bitmap.createScaledBitmap(it, SIZE, SIZE, true) }
  }

  private fun tile(label: String, hex: String): Bitmap {
    val bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(runCatching { Color.parseColor(hex) }.getOrDefault(Color.DKGRAY))
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = SIZE * 0.3f
      textAlign = Paint.Align.CENTER
      isFakeBoldText = true
    }
    val y = SIZE / 2f - (paint.descent() + paint.ascent()) / 2f
    canvas.drawText(label, SIZE / 2f, y, paint)
    return bitmap
  }

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String = "image/png"
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
```

Remove the temporary stub object from Task 9 (this file replaces it); call sites use `CarArtworkProvider.uriFor(...)` on the companion, so no call-site changes.

- [ ] **Step 3: Build and verify on the DHU**

1. Surahs tab shows surah cards; reciters show portraits or initials tiles; playlists show colored tiles with titles.
2. Turn on airplane mode after browsing once: artwork still shows.
3. Now Playing shows the surah card.

- [ ] **Step 4: Commit**

```bash
git add modules/bayaan-car/android
git commit -m "feat(android-auto): artwork content provider with offline cache"
```

---

### Task 11: iOS 26 and iOS 27 CarPlay enhancements

Layered on Task 7's baseline. Each enhancement is gated by `#available` and the baseline remains the fallback.

**Files:**
- Modify: `modules/bayaan-car/ios/CarTemplateBuilder.swift`

- [ ] **Step 1: Confirm the exact API names in the installed SDK**

Run:
```bash
SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
grep -rn -E "headerGridButtons|CPListImageRowItemCardElement|CPListImageRowItemImageGridElement|CPListImageRowItemCondensedElement|CPPlaybackConfiguration|allowsMiniPlayer" "$SDK/System/Library/Frameworks/CarPlay.framework/Headers" | head -40
```
Write the found initializer signatures into the PR description. Use only what the headers show; if a name below is absent, skip that enhancement and note it.

- [ ] **Step 2: iOS 26 Quick start as header grid buttons**

In `homeSections`, when `#available(iOS 26.0, *)`, do not add the Quick start image row; instead, after `homeTemplate.updateSections(...)` in `refresh()`:
```swift
if #available(iOS 26.0, *) {
  let quick = Array(snapshot.home.quickStart.prefix(4))
  homeTemplate.headerGridButtons = quick.map { item in
    let image = CarArtworkCache.shared.image(for: item.artwork, style: style()) { [weak self] _ in self?.refreshSoon() }
    return CPGridButton(titleVariants: [item.title], image: image) { [weak self] _ in self?.perform(item) }
  }
}
```

- [ ] **Step 3: iOS 26 card and circular rows**

Replace `imageRow(title:items:)` usage for sections with style `cards` and `circles` on iOS 26 with the element-based `CPListImageRowItem` initializers found in Step 1 (card elements for `cards`, image-grid elements with circular shape for `circles`), each element carrying its item title. Keep the existing `imageRow` for earlier iOS.

- [ ] **Step 4: iOS 27 progress and details header**

If Step 1 found `CPPlaybackConfiguration` (or equivalent), apply it to Jump back in rows using `item.progress`. If a details-header API exists, use it in `pushRewayah` with the reciter's artwork and name above the surah list.

- [ ] **Step 5: Verify on iOS 26 and iOS 27 simulator runtimes, plus an iOS 17 or 18 runtime for fallback**

Same checklist as Task 7 Step 4 items 1 to 5, on each runtime.

- [ ] **Step 6: Commit**

```bash
git add modules/bayaan-car/ios/CarTemplateBuilder.swift
git commit -m "feat(carplay): iOS 26 header buttons and card rows, iOS 27 progress"
```

---

### Task 12: Docs, spec sync, and final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-carplay-android-auto-design.md` (apply "Deviations from the spec" 1 to 5)
- Modify: `docs/features/carplay-android-auto.md` (replace body with a short pointer to the spec and this plan, keep the title)

- [ ] **Step 1: Update docs** as described above.

- [ ] **Step 2: Full verification**

```bash
npx jest --watchAll=false
npx tsc --noEmit
npx prettier --check services/car modules/bayaan-car/index.ts services/audio/LockScreenService.ts services/AppInitializer.ts plugins/withBayaanCar.js docs/superpowers
npx expo prebuild --clean
```
Expected: all pass; prebuild regenerates `ios/` and `android/` with no diff beyond what is committed (`git status --short ios android` empty).

- [ ] **Step 3: Manual release checklist** (record results in the PR)

1. CarPlay and DHU: cold start, connect mid-playback, disconnect mid-playback.
2. Airplane mode with downloads only: Library > Downloads plays.
3. New install (delete app, install, open once, connect car): Home shows situational items and playlists; no crash.
4. Phone and car stay in sync when controlling from either.
5. Real head units: one CarPlay, one Android Auto.

- [ ] **Step 4: Commit and open the PR against `develop`**

```bash
git add docs
git commit -m "docs: sync CarPlay and Android Auto spec with implementation"
git push -u origin osmansaeday/carplay
gh pr create --base develop --title "feat: CarPlay and Android Auto" --body "<summary, gate results from Tasks 1 and 2, manual checklist results>"
```
