/**
 * Browser Web Speech Synthesis wrapper.
 * Free, offline, no API key. Works on Chrome, Safari, Firefox, Edge.
 * Uses the device's built-in TTS voices.
 */

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Build a human-readable dispatch message from accident context.
 */
export function buildDispatchText({ landmark, lat, lon, plusCode, injured, blocking }) {
  const place = landmark
    ? landmark
    : `GPS ${lat?.toFixed(4)}, ${lon?.toFixed(4)}`;

  const parts = [`Road accident at ${place}.`];

  if (injured && blocking) {
    parts.push('Injured persons on scene. Vehicle is blocking traffic.');
  } else if (injured) {
    parts.push('Injured persons on scene. Vehicle is not blocking traffic.');
  } else if (blocking) {
    parts.push('No injuries reported. Vehicle is blocking traffic.');
  } else {
    parts.push('Minor incident. No injuries reported.');
  }

  parts.push('Please send emergency services immediately.');

  // Plus Code is dispatcher-friendly — speakable letter-by-letter and
  // recognized by Indian 112 ERSS. Speak it before raw GPS.
  if (plusCode) {
    parts.push(`Location plus code: ${plusCode.split('').join(' ')}.`);
  }

  if (lat != null && lon != null) {
    parts.push(`GPS coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}.`);
  }

  return parts.join(' ');
}

/**
 * Speak text aloud using Web Speech Synthesis.
 * Cancels any ongoing speech first.
 * Returns a Promise that resolves when speech ends.
 */
export function speakText(text, { rate = 0.88, pitch = 1.0, lang = 'en-IN' } = {}) {
  return new Promise((resolve, reject) => {
    if (!isSpeechSupported()) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = lang;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    window.speechSynthesis.speak(utterance);
  });
}

/** Stop any ongoing speech immediately. */
export function cancelSpeech() {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

/** Returns true if speech is currently playing. */
export function isSpeaking() {
  return isSpeechSupported() && window.speechSynthesis.speaking;
}
