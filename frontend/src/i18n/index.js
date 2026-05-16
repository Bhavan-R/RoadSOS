import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Indian (22 official languages + English)
import en   from './en.json';
import hi   from './hi.json';
import bn   from './bn.json';
import ta   from './ta.json';
import te   from './te.json';
import mr   from './mr.json';
import gu   from './gu.json';
import kn   from './kn.json';
import ml   from './ml.json';
import pa   from './pa.json';
import ur   from './ur.json';
import or   from './or.json';
import as   from './as.json';
import mai  from './mai.json';
import sat  from './sat.json';
import ks   from './ks.json';
import ne   from './ne.json';
import kok  from './kok.json';
import sd   from './sd.json';
import doi  from './doi.json';
import mni  from './mni.json';
import brx  from './brx.json';
import sa   from './sa.json';

// Global (most-spoken language per region)
import es from './es.json';
import fr from './fr.json';
import pt from './pt.json';
import de from './de.json';
import it from './it.json';
import nl from './nl.json';
import pl from './pl.json';
import ru from './ru.json';
import uk from './uk.json';
import ro from './ro.json';
import el from './el.json';
import tr from './tr.json';
import ar from './ar.json';
import fa from './fa.json';
import he from './he.json';
import sw from './sw.json';
import am from './am.json';
import id from './id.json';
import ms from './ms.json';
import th from './th.json';
import vi from './vi.json';
import zh from './zh.json';
import ja from './ja.json';
import ko from './ko.json';
import tl from './tl.json';

import { LOCALES, getLocale } from './locales';
import { languageForCountry } from './countryLanguage';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  ta: { translation: ta },
  te: { translation: te },
  mr: { translation: mr },
  gu: { translation: gu },
  kn: { translation: kn },
  ml: { translation: ml },
  pa: { translation: pa },
  ur: { translation: ur },
  or: { translation: or },
  as: { translation: as },
  mai: { translation: mai },
  sat: { translation: sat },
  ks: { translation: ks },
  ne: { translation: ne },
  kok: { translation: kok },
  sd: { translation: sd },
  doi: { translation: doi },
  mni: { translation: mni },
  brx: { translation: brx },
  sa: { translation: sa },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
  de: { translation: de },
  it: { translation: it },
  nl: { translation: nl },
  pl: { translation: pl },
  ru: { translation: ru },
  uk: { translation: uk },
  ro: { translation: ro },
  el: { translation: el },
  tr: { translation: tr },
  ar: { translation: ar },
  fa: { translation: fa },
  he: { translation: he },
  sw: { translation: sw },
  am: { translation: am },
  id: { translation: id },
  ms: { translation: ms },
  th: { translation: th },
  vi: { translation: vi },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  tl: { translation: tl },
};

const LS_KEY = 'roadsos:lang';

function detectInitialLanguage() {
  // 1. Explicit user choice from a previous session
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && resources[saved]) return saved;
  } catch {}

  // 2. Browser preference (only if we ship that language)
  if (typeof navigator !== 'undefined') {
    const browserLang = (navigator.language || 'en').split('-')[0].toLowerCase();
    if (resources[browserLang]) return browserLang;
  }

  return 'en';
}

const initialLang = detectInitialLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Keep document direction in sync (rtl/ltr) for Arabic, Urdu, etc.
function applyDir(code) {
  if (typeof document === 'undefined') return;
  const loc = getLocale(code);
  document.documentElement.lang = loc.bcp47 || code;
  document.documentElement.dir = loc.dir || 'ltr';
}

applyDir(initialLang);

export function changeLanguage(code) {
  if (!resources[code]) return;
  i18n.changeLanguage(code);
  try { localStorage.setItem(LS_KEY, code); } catch {}
  applyDir(code);
}

/** Whether the user has explicitly picked a language (gates first-run picker). */
export function hasUserChosenLanguage() {
  try { return !!localStorage.getItem(LS_KEY); } catch { return false; }
}

/**
 * Resolve the best default language for a GPS-derived country code.
 * Returns null if we cannot determine a sensible default.
 */
export function suggestLanguageForCountry(countryCode) {
  const code = languageForCountry(countryCode);
  return code && resources[code] ? code : null;
}

export { LOCALES };
export default i18n;
