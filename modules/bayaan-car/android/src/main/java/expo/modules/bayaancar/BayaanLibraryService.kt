package expo.modules.bayaancar

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionError
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

@UnstableApi
class BayaanLibraryService : MediaLibraryService() {
  private var session: MediaLibrarySession? = null
  private var player: CarForwardingPlayer? = null
  private val rateCommand = SessionCommand("bayaan.cycleRate", Bundle.EMPTY)
  private val loveCommand = SessionCommand("bayaan.toggleLove", Bundle.EMPTY)
  private val repeatCommand = SessionCommand("bayaan.cycleRepeat", Bundle.EMPTY)

  // Every connected car controller counts. Android Auto opens several connections.
  private val carControllers = mutableSetOf<MediaSession.ControllerInfo>()
  private var lastButtonKey: Pair<Boolean, String?>? = null

  // Parent ids each controller subscribed to, so a snapshot change refreshes all of them.
  private val subscriptions = mutableSetOf<Pair<MediaSession.ControllerInfo, String>>()

  private val snapshotListener: () -> Unit = {
    val s = session
    if (s != null) {
      val ids = (listOf("root") + CarBrowseTree.tabs.map { it.first } + subscriptions.map { it.second }).distinct()
      ids.forEach { id -> s.notifyChildrenChanged(id, CarBrowseTree.children(id).size, null) }
    }
  }
  private val nowPlayingListener: () -> Unit = {
    val np = CarBridge.nowPlaying
    val key = Pair(np?.isLoved == true, np?.repeatMode)
    if (key != lastButtonKey) {
      lastButtonKey = key
      session?.setMediaButtonPreferences(buttons())
    }
  }

  // Besides the forwarding player's error state, send a documented non-fatal session error.
  private val jsUnavailableListener: () -> Unit = {
    if (CarBridge.jsUnavailable) {
      session?.sendError(SessionError(SessionError.ERROR_SESSION_SETUP_REQUIRED, CarRequestGate.UNAVAILABLE_MESSAGE))
    }
  }

  override fun onCreate() {
    super.onCreate()
    CarBrand.init(applicationContext)
    CarBridge.init(applicationContext)
    val p = CarForwardingPlayer(mainLooper)
    player = p
    lastButtonKey = CarBridge.nowPlaying?.let { it.isLoved to it.repeatMode }
    session = MediaLibrarySession.Builder(this, p, Callback())
      .setId("bayaan-car")
      .setMediaButtonPreferences(buttons())
      .build()
    CarBridge.onSnapshotChanged.add(snapshotListener)
    CarBridge.onNowPlayingChanged.add(nowPlayingListener)
    CarBridge.onJsUnavailableChanged.add(jsUnavailableListener)
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

  // Defense in depth. Nothing should start us as a foreground service (the manifest has no
  // media button receiver for it and its MediaLibraryService action is removed so Media3 does
  // not register one). If something still does, Android crashes the app unless startForeground
  // runs, and even a stop without it crashes. So satisfy it with a minimal notification that is
  // removed at once, and never forward the key to JS from here.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action != Intent.ACTION_MEDIA_BUTTON) return super.onStartCommand(intent, flags, startId)
    runCatching { satisfyForegroundStart() }.onFailure { CarLog.d("foreground start fallback failed: $it") }
    stopSelf(startId)
    return START_NOT_STICKY
  }

  private fun satisfyForegroundStart() {
    val manager = getSystemService(NotificationManager::class.java)
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(NotificationChannel(FGS_CHANNEL, "${CarBrand.name} car", NotificationManager.IMPORTANCE_MIN))
      Notification.Builder(this, FGS_CHANNEL)
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
    val notification = builder.setSmallIcon(applicationInfo.icon).setContentTitle(CarBrand.name).build()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(FGS_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(FGS_NOTIFICATION_ID, notification)
    }
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
  }

  // expo-audio's AudioControlsService owns the phone notification and foreground state.
  // Media3 only starts a foreground service from the notification manager, which this
  // no-op bypasses, so this service is never foreground-required.
  override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) = Unit

  override fun onDestroy() {
    CarBridge.onSnapshotChanged.remove(snapshotListener)
    CarBridge.onNowPlayingChanged.remove(nowPlayingListener)
    CarBridge.onJsUnavailableChanged.remove(jsUnavailableListener)
    carControllers.clear()
    CarBridge.setConnected(false)
    CarReactRoot.stop(this)
    subscriptions.clear()
    player?.detach()
    player?.release()
    session?.release()
    session = null
    player = null
    super.onDestroy()
  }

  private fun MediaSession.isCar(controller: MediaSession.ControllerInfo): Boolean =
    isAutoCompanionController(controller) || isAutomotiveController(controller) ||
      controller.packageName == GEARHEAD_PACKAGE

  private inner class Callback : MediaLibrarySession.Callback {
    override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult {
      val isCar = session.isCar(controller)
      if (!CarControllerPolicy.isAllowed(controller.packageName, packageName, isCar, controller.isTrusted)) {
        return MediaSession.ConnectionResult.reject()
      }
      if (isCar) {
        carControllers.add(controller)
        CarBridge.setConnected(true)
        // With no Activity there is no React tree (player, car bridge), and with no resumed
        // Activity JS timers pause. Start the headless car root and its keep-alive task; if
        // the phone app is running the root shares that runtime and renders nothing.
        // Requests queue meanwhile (CarRequestGate).
        CarReactRoot.onCarConnected(this@BayaanLibraryService)
      }
      val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
        .add(rateCommand)
        .add(loveCommand)
        .add(repeatCommand)
        .build()
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session).setAvailableSessionCommands(commands).build()
    }

    // Legacy MediaBrowser clients (Android Auto) are only removed after Media3's idle
    // timeout or onDestroy, so a car disconnect can lag. The 10s skip buttons return then.
    override fun onDisconnected(session: MediaSession, controller: MediaSession.ControllerInfo) {
      subscriptions.removeAll { it.first == controller }
      if (carControllers.remove(controller) && carControllers.isEmpty()) {
        CarBridge.setConnected(false)
        CarReactRoot.onCarDisconnected()
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

    override fun onSubscribe(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<Void>> {
      subscriptions.add(browser to parentId)
      return Futures.immediateFuture(LibraryResult.ofVoid())
    }

    override fun onUnsubscribe(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
    ): ListenableFuture<LibraryResult<Void>> {
      subscriptions.remove(browser to parentId)
      return Futures.immediateFuture(LibraryResult.ofVoid())
    }

    override fun onGetChildren(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> =
      Futures.immediateFuture(
        LibraryResult.ofItemList(ImmutableList.copyOf(CarBrowseTree.slice(CarBrowseTree.children(parentId), page, pageSize)), params),
      )

    override fun onSetMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
      startIndex: Int,
      startPositionMs: Long,
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      val chosen = mediaItems.getOrNull(maxOf(startIndex, 0)) ?: mediaItems.firstOrNull()
      val request = chosen?.let { requestFor(it) }
        ?: return Futures.immediateFailedFuture(UnsupportedOperationException("no playable request"))
      player?.notePlayRequestSent()
      CarBridge.sendPlay(request)
      // Keep the forwarding player's own playlist; JS will push the real queue.
      return Futures.immediateFuture(MediaSession.MediaItemsWithStartPosition(ImmutableList.of(), 0, 0))
    }

    // A system resume (media button, restore) asks for the last session. JS owns that
    // state, so forward a resume request and fail the future, which Media3 handles.
    override fun onPlaybackResumption(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      isForPlayback: Boolean,
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      if (isForPlayback && player?.hasRecentPlayRequest() != true) {
        player?.notePlayRequestSent()
        CarBridge.sendPlay(RESUME_REQUEST)
      }
      return Futures.immediateFailedFuture(UnsupportedOperationException("playback resumption is handled by JS"))
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
      val results = CarSearch.search(CarBridge.snapshot, query).map { match ->
        MediaItem.Builder().setMediaId(CarBrowseTree.playId(match.request)).setMediaMetadata(
          MediaMetadata.Builder()
            .setTitle(match.title).setSubtitle(match.subtitle)
            .setIsBrowsable(false).setIsPlayable(true)
            .setArtworkUri(CarArtworkProvider.uriFor(match.artwork))
            .build(),
        ).build()
      }
      val items = CarBrowseTree.slice(results, page, pageSize)
      return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(items), params))
    }
  }

  /** The play request for a tapped item or a voice query. A blank query ("play something") resumes. */
  private fun requestFor(item: MediaItem): String? {
    CarBrowseTree.requestFromPlayId(item.mediaId)?.let { return it }
    val query = item.requestMetadata.searchQuery ?: return null
    if (query.isBlank()) return RESUME_REQUEST
    return CarSearch.search(query).firstOrNull()?.request
  }

  private companion object {
    const val GEARHEAD_PACKAGE = "com.google.android.projection.gearhead"
    const val FGS_CHANNEL = "bayaan_car_fgs"
    const val FGS_NOTIFICATION_ID = 7421
    const val RESUME_REQUEST = "{\"kind\":\"resume\"}"
  }
}
