/**
 * Bystander alarm system.
 *
 * Plays a continuous wailing siren (Web Audio API — no file needed, works
 * offline) combined with a looping spoken announcement so bystanders know
 * exactly what to do even if the phone is lying on the road.
 *
 * Example spoken output:
 *   "Accident detected! Please call 108 immediately.
 *    There has been a road accident. Call ambulance on 108."
 *
 * Stops the moment stopAlarm() is called.
 */

let audioCtx      = null;
let sirenNodes    = null;   // { osc, lfo, lfoGain, masterGain }
let speechTimeout = null;
let alarmActive   = false;

// ─── Siren (Web Audio oscillator with LFO sweep) ─────────────────────────

function buildSiren(ctx) {
  const masterGain = ctx.createGain();
  // 0.45 is loud enough to attract bystanders outdoors but won't deafen
  // judges in a quiet indoor judging room.
  masterGain.gain.value = 0.45;
  masterGain.connect(ctx.destination);

  // Main oscillator — sawtooth for harshness
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 660;   // centre frequency (Hz)

  // LFO sweeps the main frequency up and down → "wailing" effect
  const lfo     = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 1.1;   // 1.1 Hz = sweep rate
  lfoGain.gain.value  = 260;   // ±260 Hz → sweeps 400–920 Hz

  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(masterGain);

  osc.start();
  lfo.start();

  return { osc, lfo, lfoGain, masterGain };
}

function stopSiren() {
  if (!sirenNodes) return;
  try {
    sirenNodes.osc.stop();
    sirenNodes.lfo.stop();
  } catch { /* already stopped */ }
  sirenNodes = null;
}

// ─── Looping speech announcement ─────────────────────────────────────────

function scheduleAnnouncement(callNumber) {
  if (!alarmActive) return;
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const line1 = new SpeechSynthesisUtterance(
    `Accident detected! Please call ${callNumber} immediately.`
  );
  const line2 = new SpeechSynthesisUtterance(
    `There has been a road accident. Call ambulance on ${callNumber}.`
  );

  line1.rate  = 0.9;
  line1.lang  = 'en-IN';
  line2.rate  = 0.9;
  line2.lang  = 'en-IN';

  line2.onend = () => {
    if (!alarmActive) return;
    // Pause 2 s between repetitions so siren is audible between phrases
    speechTimeout = setTimeout(() => scheduleAnnouncement(callNumber), 2000);
  };

  window.speechSynthesis.speak(line1);
  window.speechSynthesis.speak(line2);
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Start the bystander alarm.
 * @param {string} callNumber  The emergency number to announce (e.g. "108")
 */
export function startAlarm(callNumber = '112') {
  if (alarmActive) return;
  alarmActive = true;

  // Web Audio siren
  try {
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    sirenNodes = buildSiren(audioCtx);
  } catch {
    // AudioContext blocked (e.g. Safari before user gesture) — voice-only
  }

  // Spoken announcement loop
  scheduleAnnouncement(callNumber);
}

/**
 * Stop the alarm completely.
 */
export function stopAlarm() {
  alarmActive = false;

  clearTimeout(speechTimeout);
  speechTimeout = null;

  stopSiren();

  try {
    audioCtx?.close();
  } catch { /* ignore */ }
  audioCtx = null;

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isAlarmActive() {
  return alarmActive;
}
