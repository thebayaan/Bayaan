package expo.modules.bayaancar

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import java.io.File

/**
 * Threading model: snapshot, nowPlaying, connection, jsReady, pending, emit,
 * owner and the listener lists are read and written on the main looper only.
 * Entry points called from other threads (the Expo module on the JS thread)
 * post to main. File IO and JSON parsing happen on the caller's thread.
 *
 * The emitter is owned by one module instance (owner token). A late
 * unregister from an old instance after a reload cannot clear the new
 * instance's emitter or ready flag.
 */
object CarBridge {
  private const val MAX_PENDING = 32
  private val main = Handler(Looper.getMainLooper())

  @Volatile private var file: File? = null

  @Volatile var snapshot: CarSnapshot? = null
    private set
  @Volatile var nowPlaying: CarNowPlaying? = null
    private set
  var isConnected = false
    private set

  /**
   * True after a request waited out its grace period with no ready JS (see CarRequestGate).
   * The forwarding player shows it as a player error. Cleared by markJsReady or a non-null
   * now playing update.
   */
  var jsUnavailable = false
    private set
  val onJsUnavailableChanged = mutableListOf<() -> Unit>()

  val onSnapshotChanged = mutableListOf<() -> Unit>()
  val onNowPlayingChanged = mutableListOf<() -> Unit>()

  private var emit: ((String, Map<String, Any>) -> Unit)? = null
  private var owner: Any? = null
  private var jsReady = false
  private val pending = mutableListOf<Pair<String, Map<String, Any>>>()
  private var waitingSinceMs: Long? = null
  private val graceCheck = Runnable { checkGrace() }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  @Synchronized
  fun init(context: Context) {
    if (file != null) return
    CarLog.enabled = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    val f = File(context.filesDir, "bayaan-car/snapshot.json")
    file = f
    if (!f.exists()) return
    val parsed = runCatching { CarSnapshot.parse(f.readText()) }.getOrNull() ?: return
    onMain {
      // A snapshot written by JS in the meantime is newer; keep it.
      if (snapshot == null) {
        snapshot = parsed
        onSnapshotChanged.forEach { it() }
      }
    }
  }

  /**
   * Reads and parses the persisted snapshot on the calling thread (for binder threads such
   * as the artwork provider). Does not touch bridge state unless the bridge snapshot is
   * still empty, in which case it is published on main.
   */
  fun loadSnapshotBlocking(context: Context): CarSnapshot? {
    snapshot?.let { return it }
    val f = File(context.filesDir, "bayaan-car/snapshot.json")
    if (!f.exists()) return null
    val parsed = runCatching { CarSnapshot.parse(f.readText()) }.getOrNull() ?: return null
    onMain {
      if (snapshot == null) {
        snapshot = parsed
        onSnapshotChanged.forEach { it() }
      }
    }
    return parsed
  }

  /** A new module instance (new JS runtime) takes over. Not ready until markJsReady. */
  fun registerEmitter(token: Any, emitter: (String, Map<String, Any>) -> Unit) = onMain {
    owner = token
    emit = emitter
    jsReady = false
  }

  /** Clears emitter state only if [token] still owns it. */
  fun unregisterEmitter(token: Any) = onMain {
    if (owner !== token) return@onMain
    owner = null
    emit = null
    jsReady = false
  }

  fun writeSnapshot(json: String) {
    val parsed = CarSnapshot.parse(json)
    if (parsed == null) {
      CarLog.d("snapshot parse failed or unsupported version")
      return
    }
    file?.let { f ->
      runCatching {
        f.parentFile?.mkdirs()
        val tmp = File(f.parentFile, "snapshot.json.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(f)) tmp.delete()
      }.onFailure { CarLog.d("snapshot write failed: $it") }
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
      if (parsed != null) setJsUnavailable(false)
      onNowPlayingChanged.forEach { it() }
    }
  }

  fun markJsReady() {
    main.post {
      // Never flush into a missing emitter: keep events queued.
      val e = emit ?: return@post
      jsReady = true
      main.removeCallbacks(graceCheck)
      waitingSinceMs = null
      setJsUnavailable(false)
      // Connection first: JS must apply car mode before a queued play request
      // loads a track and re-activates the media session controls.
      e("onCarConnectionChanged", mapOf("connected" to isConnected))
      val queued = pending.toList()
      pending.clear()
      queued.forEach { (name, body) -> e(name, body) }
    }
  }

  fun sendPlay(requestJson: String) = send("onPlayRequest", requestJson)
  fun sendTransport(transportJson: String) = send("onTransport", transportJson)

  fun setConnected(connected: Boolean) {
    main.post {
      isConnected = connected
      // A fresh car connection starts without a stale "open on phone" error.
      if (connected) setJsUnavailable(false)
      if (jsReady) emit?.invoke("onCarConnectionChanged", mapOf("connected" to connected))
    }
  }

  private fun send(event: String, json: String) {
    main.post {
      val body = mapOf<String, Any>("json" to json)
      val e = emit
      if (jsReady && e != null) {
        e(event, body)
        return@post
      }
      val now = SystemClock.elapsedRealtime()
      // A new play request supersedes everything queued before it and gets a fresh grace period.
      if (event == "onPlayRequest") {
        pending.clear()
        waitingSinceMs = now
        // Show loading, not the previous error, while this request waits.
        setJsUnavailable(false)
      } else if (waitingSinceMs == null) {
        waitingSinceMs = now
      }
      pending.add(event to body)
      while (pending.size > MAX_PENDING) pending.removeAt(0)
      scheduleGraceCheck(now)
    }
  }

  // Main only. Requests succeed once a React root (the phone app's, or the headless
  // car root BayaanLibraryService starts) has booted the player and car bridge.
  private fun scheduleGraceCheck(now: Long) {
    val since = waitingSinceMs ?: return
    main.removeCallbacks(graceCheck)
    val delay = since + CarRequestGate.graceMs(emit != null, CarReactRoot.isRunning) - now
    main.postDelayed(graceCheck, delay.coerceAtLeast(0L))
  }

  private fun checkGrace() {
    val now = SystemClock.elapsedRealtime()
    when (CarRequestGate.decide(jsReady && emit != null, emit != null, waitingSinceMs, now, CarReactRoot.isRunning)) {
      GateDecision.DELIVER -> Unit
      GateDecision.WAIT -> scheduleGraceCheck(now)
      GateDecision.FAIL -> {
        CarLog.d("JS not ready after grace; dropping ${pending.size} queued car event(s)")
        pending.clear()
        waitingSinceMs = null
        // Notify even when already unavailable, so every failed tap surfaces the error again.
        jsUnavailable = true
        onJsUnavailableChanged.forEach { it() }
      }
    }
  }

  private fun setJsUnavailable(value: Boolean) {
    if (jsUnavailable == value) return
    jsUnavailable = value
    onJsUnavailableChanged.forEach { it() }
  }
}
