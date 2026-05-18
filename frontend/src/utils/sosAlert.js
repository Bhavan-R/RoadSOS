/**
 * SOS alert — emergency audio tone + scene photo capture + torch flash.
 *
 * Called the moment SOS fires (manual tap or crash auto-send) to:
 *   1. Play an audio alert tone (Web Audio API — instant, no file needed)
 *   2. Capture a rear-camera photo of the accident scene (shown in dispatch)
 *   3. Flash the device torch 3× as a visual distress signal
 *
 * The scene photo is stored in-memory so the DispatchScreen can display it.
 * We combine photo capture + torch flash into a single camera session to
 * minimise permission prompts and camera access time.
 */

let _audioCtx = null;

/** Last captured scene photo as a data-URL (JPEG).  null if none. */
let _scenePhoto = null;

/** Get the most recent scene photo data URL. */
export function getScenePhoto() { return _scenePhoto; }

/** Clear the stored scene photo (e.g. when dismissing dispatch). */
export function clearScenePhoto() { _scenePhoto = null; }

// ─── Audio ────────────────────────────────────────────────────────────────────

/**
 * Play a 3-beep SOS alert (high–low–high) via Web Audio API.
 * Total duration ≈ 0.55 s so it doesn't block the UI thread.
 */
export function playSOSAlert() {
  try {
    _audioCtx =
      _audioCtx ||
      new (window.AudioContext || window.webkitAudioContext)();

    // Browsers may suspend AudioContext until a user gesture; resume if so.
    if (_audioCtx.state === 'suspended') _audioCtx.resume();

    const BEEPS = [
      { freq: 880, start: 0.00, dur: 0.12 },   // high
      { freq: 660, start: 0.18, dur: 0.12 },   // low
      { freq: 880, start: 0.36, dur: 0.18 },   // high (longer)
    ];

    BEEPS.forEach(({ freq, start, dur }) => {
      const osc  = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, _audioCtx.currentTime + start);

      // Ramp up → sustain → ramp down (no click artifacts)
      gain.gain.setValueAtTime(0, _audioCtx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.55, _audioCtx.currentTime + start + 0.01);
      gain.gain.linearRampToValueAtTime(0,    _audioCtx.currentTime + start + dur);

      osc.start(_audioCtx.currentTime + start);
      osc.stop (_audioCtx.currentTime + start + dur + 0.02);
    });
  } catch {
    // Web Audio unavailable (old browser, WebView restriction, etc.)
  }
}

// ─── Scene photo + torch ──────────────────────────────────────────────────────

/**
 * Capture a scene photo from the rear camera AND flash the torch.
 *
 * Strategy: open one camera session, use it for both photo + torch,
 * then release. This avoids multiple permission prompts.
 *
 * If the user hasn't granted camera permission yet, the browser will
 * prompt — but now the prompt is justified because we're actually
 * taking a photo of the accident scene (not just flashing the torch).
 *
 * Returns the captured photo as a JPEG data URL, or null on failure.
 * Also stores it in the module-level _scenePhoto for later retrieval.
 */
export async function captureSceneAndFlash() {
  let stream = null;
  try {
    stream = await navigator.mediaDevices?.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    if (!stream) return null;

    const track = stream.getVideoTracks()[0];
    if (!track) return null;

    // ── Step 1: Capture a photo via canvas ──────────────────────────────
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');   // iOS requires this
    video.muted = true;
    await video.play();

    // Let auto-exposure settle (300 ms)
    await new Promise(r => setTimeout(r, 300));

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add timestamp overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(
      `RoadSOS · ${new Date().toLocaleString()} · Scene Photo`,
      10, canvas.height - 12
    );

    _scenePhoto = canvas.toDataURL('image/jpeg', 0.7);

    video.pause();
    video.srcObject = null;

    // ── Step 2: Flash torch (if available) ──────────────────────────────
    const caps = track.getCapabilities?.();
    if (caps?.torch) {
      const PATTERN = [true, false, true, false, true, false];
      for (const on of PATTERN) {
        await track.applyConstraints({ advanced: [{ torch: on }] });
        await new Promise(r => setTimeout(r, 250));
      }
      await track.applyConstraints({ advanced: [{ torch: false }] });
    }

    return _scenePhoto;
  } catch {
    // Permission denied, no camera, or any other error — silent
    return null;
  } finally {
    stream?.getTracks().forEach(t => t.stop());
  }
}

// ─── Combined entry point ─────────────────────────────────────────────────────

/**
 * Fire all SOS alert channels simultaneously.
 * Call this inside a user-gesture handler (button click / crash auto-fire).
 *
 * Returns a Promise<string|null> — the scene photo data URL (or null).
 */
export async function triggerSOSAlert() {
  playSOSAlert();                     // sync, ~0 ms delay
  return captureSceneAndFlash();      // async, returns photo data URL
}
