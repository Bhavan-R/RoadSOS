// Supported locales for RoadSOS.
// India: every official language of the 8th Schedule of the Constitution.
// World: the most-used language for each remaining country.
//
// `code`    — i18next key (ISO 639-1 / 639-2 / 639-3 as appropriate).
// `native`  — language name in its own script (for the picker).
// `english` — language name in English.
// `bcp47`   — BCP-47 tag.
// `dir`     — text direction; 'rtl' triggers right-to-left layout.
// `region`  — UI grouping label in the picker.

export const LOCALES = [
  // ── English (universal default) ──────────────────────────────────────────
  { code: 'en',  native: 'English',         english: 'English',          bcp47: 'en',     dir: 'ltr', region: 'World' },

  // ── 22 official languages of India (8th Schedule) ────────────────────────
  { code: 'hi',  native: 'हिन्दी',           english: 'Hindi',            bcp47: 'hi-IN',  dir: 'ltr', region: 'India' },
  { code: 'bn',  native: 'বাংলা',            english: 'Bengali',          bcp47: 'bn-IN',  dir: 'ltr', region: 'India' },
  { code: 'ta',  native: 'தமிழ்',            english: 'Tamil',            bcp47: 'ta-IN',  dir: 'ltr', region: 'India' },
  { code: 'te',  native: 'తెలుగు',            english: 'Telugu',           bcp47: 'te-IN',  dir: 'ltr', region: 'India' },
  { code: 'mr',  native: 'मराठी',             english: 'Marathi',          bcp47: 'mr-IN',  dir: 'ltr', region: 'India' },
  { code: 'gu',  native: 'ગુજરાતી',           english: 'Gujarati',         bcp47: 'gu-IN',  dir: 'ltr', region: 'India' },
  { code: 'kn',  native: 'ಕನ್ನಡ',             english: 'Kannada',          bcp47: 'kn-IN',  dir: 'ltr', region: 'India' },
  { code: 'ml',  native: 'മലയാളം',         english: 'Malayalam',        bcp47: 'ml-IN',  dir: 'ltr', region: 'India' },
  { code: 'pa',  native: 'ਪੰਜਾਬੀ',           english: 'Punjabi',          bcp47: 'pa-IN',  dir: 'ltr', region: 'India' },
  { code: 'ur',  native: 'اردو',             english: 'Urdu',             bcp47: 'ur',     dir: 'rtl', region: 'India' },
  { code: 'or',  native: 'ଓଡ଼ିଆ',             english: 'Odia',             bcp47: 'or-IN',  dir: 'ltr', region: 'India' },
  { code: 'as',  native: 'অসমীয়া',           english: 'Assamese',         bcp47: 'as-IN',  dir: 'ltr', region: 'India' },
  { code: 'mai', native: 'मैथिली',            english: 'Maithili',         bcp47: 'mai',    dir: 'ltr', region: 'India' },
  { code: 'sat', native: 'ᱥᱟᱱᱛᱟᱲᱤ',         english: 'Santali',          bcp47: 'sat',    dir: 'ltr', region: 'India' },
  { code: 'ks',  native: 'کٲشُر',             english: 'Kashmiri',         bcp47: 'ks',     dir: 'rtl', region: 'India' },
  { code: 'ne',  native: 'नेपाली',            english: 'Nepali',           bcp47: 'ne',     dir: 'ltr', region: 'India' },
  { code: 'kok', native: 'कोंकणी',            english: 'Konkani',          bcp47: 'kok',    dir: 'ltr', region: 'India' },
  { code: 'sd',  native: 'سنڌي',             english: 'Sindhi',           bcp47: 'sd',     dir: 'rtl', region: 'India' },
  { code: 'doi', native: 'डोगरी',             english: 'Dogri',            bcp47: 'doi',    dir: 'ltr', region: 'India' },
  { code: 'mni', native: 'ꯃꯩꯇꯩꯂꯣꯟ',         english: 'Manipuri (Meitei)', bcp47: 'mni',   dir: 'ltr', region: 'India' },
  { code: 'brx', native: 'बड़ो',              english: 'Bodo',             bcp47: 'brx',    dir: 'ltr', region: 'India' },
  { code: 'sa',  native: 'संस्कृतम्',         english: 'Sanskrit',         bcp47: 'sa',     dir: 'ltr', region: 'India' },

  // ── Global (one entry per primary language; many countries share) ────────
  { code: 'es',  native: 'Español',          english: 'Spanish',          bcp47: 'es',     dir: 'ltr', region: 'World' },
  { code: 'fr',  native: 'Français',         english: 'French',           bcp47: 'fr',     dir: 'ltr', region: 'World' },
  { code: 'pt',  native: 'Português',        english: 'Portuguese',       bcp47: 'pt',     dir: 'ltr', region: 'World' },
  { code: 'de',  native: 'Deutsch',          english: 'German',           bcp47: 'de',     dir: 'ltr', region: 'World' },
  { code: 'it',  native: 'Italiano',         english: 'Italian',          bcp47: 'it',     dir: 'ltr', region: 'World' },
  { code: 'nl',  native: 'Nederlands',       english: 'Dutch',            bcp47: 'nl',     dir: 'ltr', region: 'World' },
  { code: 'pl',  native: 'Polski',           english: 'Polish',           bcp47: 'pl',     dir: 'ltr', region: 'World' },
  { code: 'ru',  native: 'Русский',          english: 'Russian',          bcp47: 'ru',     dir: 'ltr', region: 'World' },
  { code: 'uk',  native: 'Українська',       english: 'Ukrainian',        bcp47: 'uk',     dir: 'ltr', region: 'World' },
  { code: 'ro',  native: 'Română',           english: 'Romanian',         bcp47: 'ro',     dir: 'ltr', region: 'World' },
  { code: 'el',  native: 'Ελληνικά',         english: 'Greek',            bcp47: 'el',     dir: 'ltr', region: 'World' },
  { code: 'tr',  native: 'Türkçe',           english: 'Turkish',          bcp47: 'tr',     dir: 'ltr', region: 'World' },
  { code: 'ar',  native: 'العربية',          english: 'Arabic',           bcp47: 'ar',     dir: 'rtl', region: 'World' },
  { code: 'fa',  native: 'فارسی',            english: 'Persian',          bcp47: 'fa',     dir: 'rtl', region: 'World' },
  { code: 'he',  native: 'עברית',            english: 'Hebrew',           bcp47: 'he',     dir: 'rtl', region: 'World' },
  { code: 'sw',  native: 'Kiswahili',        english: 'Swahili',          bcp47: 'sw',     dir: 'ltr', region: 'World' },
  { code: 'am',  native: 'አማርኛ',           english: 'Amharic',          bcp47: 'am',     dir: 'ltr', region: 'World' },
  { code: 'id',  native: 'Bahasa Indonesia', english: 'Indonesian',       bcp47: 'id',     dir: 'ltr', region: 'World' },
  { code: 'ms',  native: 'Bahasa Melayu',    english: 'Malay',            bcp47: 'ms',     dir: 'ltr', region: 'World' },
  { code: 'th',  native: 'ไทย',              english: 'Thai',             bcp47: 'th',     dir: 'ltr', region: 'World' },
  { code: 'vi',  native: 'Tiếng Việt',       english: 'Vietnamese',       bcp47: 'vi',     dir: 'ltr', region: 'World' },
  { code: 'zh',  native: '中文',              english: 'Chinese',          bcp47: 'zh',     dir: 'ltr', region: 'World' },
  { code: 'ja',  native: '日本語',            english: 'Japanese',         bcp47: 'ja',     dir: 'ltr', region: 'World' },
  { code: 'ko',  native: '한국어',             english: 'Korean',           bcp47: 'ko',     dir: 'ltr', region: 'World' },
  { code: 'tl',  native: 'Tagalog',          english: 'Filipino',         bcp47: 'tl',     dir: 'ltr', region: 'World' },
];

export const getLocale = (code) => LOCALES.find((l) => l.code === code) || LOCALES[0];
