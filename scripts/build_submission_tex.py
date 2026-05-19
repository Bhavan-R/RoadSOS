"""Build the National Road Safety Hackathon 2026 submission as a LaTeX document.

The CoERS x IIT Madras rulebook requires:
  (1) The entire code
  (2) A list of software packages used
  (3) Assumptions

Usage:
  python scripts/build_submission_tex.py
Outputs:
  docs/RoadSOS_Submission.tex   (source — also submitted)
  docs/RoadSOS_Submission.pdf   (compiled PDF, opened by judges)
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_TEX = ROOT / "docs" / "RoadSOS_Submission.tex"
OUT_PDF = ROOT / "docs" / "RoadSOS_Submission.pdf"

# ──────────────────────────────────────────────────────────────────────────────
# Files to include in the code appendix (grouped)
# ──────────────────────────────────────────────────────────────────────────────

CODE_GROUPS: list[tuple[str, list[str]]] = [
    (
        "Root configuration",
        [
            "README.md",
            "CLAUDE.md",
            "vercel.json",
            ".github/workflows/backend-tests.yml",
            ".github/workflows/frontend-ci.yml",
            ".github/workflows/pr-guard.yml",
        ],
    ),
    (
        "Backend --- top level",
        [
            "backend/requirements.txt",
            "backend/requirements-dev.txt",
            "backend/ruff.toml",
            "backend/main.py",
            "backend/middleware.py",
            "backend/logging_config.py",
        ],
    ),
    (
        "Backend --- services",
        sorted(
            str(p.relative_to(ROOT)).replace("\\", "/")
            for p in (ROOT / "backend" / "services").glob("*.py")
        ),
    ),
    (
        "Backend --- tests",
        sorted(
            str(p.relative_to(ROOT)).replace("\\", "/")
            for p in (ROOT / "backend" / "tests").glob("*.py")
        ),
    ),
    (
        "Frontend --- configuration",
        [
            "frontend/package.json",
            "frontend/vite.config.js",
            "frontend/index.html",
            "frontend/vercel.json",
            "frontend/tsconfig.json",
        ],
    ),
    (
        "Frontend --- entry point",
        ["frontend/src/App.jsx", "frontend/src/constants.js"],
    ),
    (
        "Frontend --- components",
        sorted(
            str(p.relative_to(ROOT)).replace("\\", "/")
            for p in (ROOT / "frontend" / "src" / "components").glob("*.jsx")
        ),
    ),
    (
        "Frontend --- hooks",
        sorted(
            str(p.relative_to(ROOT)).replace("\\", "/")
            for p in (ROOT / "frontend" / "src" / "hooks").glob("*.js")
        ),
    ),
    (
        "Frontend --- utilities",
        sorted(
            str(p.relative_to(ROOT)).replace("\\", "/")
            for p in (ROOT / "frontend" / "src" / "utils").glob("*.js")
        ),
    ),
    (
        "Frontend --- styles",
        ["frontend/src/style.css", "frontend/src/final-design.css"],
    ),
    (
        "Frontend --- bundled data",
        sorted(
            str(p.relative_to(ROOT)).replace("\\", "/")
            for p in (ROOT / "frontend" / "src" / "data").glob("*.json")
        ),
    ),
    (
        "Frontend --- i18n (48 locale bundles)",
        [
            "frontend/src/i18n/index.js",
            "frontend/src/i18n/locales.js",
            "frontend/src/i18n/countryLanguage.js",
        ]
        + sorted(
            str(p.relative_to(ROOT)).replace("\\", "/")
            for p in (ROOT / "frontend" / "src" / "i18n").glob("*.json")
        ),
    ),
    (
        "Frontend --- tests",
        sorted(
            [
                str(p.relative_to(ROOT)).replace("\\", "/")
                for p in (ROOT / "frontend" / "src" / "__tests__").glob("*.js")
            ]
            + [
                str(p.relative_to(ROOT)).replace("\\", "/")
                for p in (ROOT / "frontend" / "src" / "utils" / "__tests__").glob("*.js")
            ]
        ),
    ),
]

LANG_BY_SUFFIX = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JSX",
    ".json": "JSON", ".css": "CSS", ".html": "HTML",
    ".yml": "YAML", ".yaml": "YAML", ".toml": "TOML",
    ".md": "Markdown", ".txt": "text",
}

# ──────────────────────────────────────────────────────────────────────────────
# LaTeX escaping / helpers
# ──────────────────────────────────────────────────────────────────────────────

_ESC_TABLE = str.maketrans({
    "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
    "_": r"\_", "{": r"\{", "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
    "\\": r"\textbackslash{}",
})


def esc(s: str) -> str:
    """Escape special LaTeX characters in running text."""
    return s.translate(_ESC_TABLE)


def _has_non_ascii(s: str) -> bool:
    return any(ord(c) > 127 for c in s)


def verbatim_block(code: str, lang: str = "", max_chars: int = 200_000) -> str:
    """Return an lstlisting verbatim block for the given code.

    Files containing non-ASCII characters (RTL locale bundles, etc.) are
    rendered as a sanitised ASCII-safe version with non-ASCII runs replaced by
    [U+XXXX] placeholders so LuaLaTeX doesn't choke on them.
    """
    truncated = False
    if len(code) > max_chars:
        code = code[:max_chars]
        truncated = True
    # Normalise CRLF
    code = code.replace("\r\n", "\n")
    # Replace null bytes
    code = code.replace("\x00", "")

    # Sanitise non-ASCII characters for lstlisting
    if _has_non_ascii(code):
        sanitised = []
        for ch in code:
            if ord(ch) > 127:
                sanitised.append(f"[U+{ord(ch):04X}]")
            else:
                sanitised.append(ch)
        code = "".join(sanitised)

    trailer = "\n% ... (file truncated)\n" if truncated else ""
    # lstlisting built-in languages: Python, HTML, CSS.
    # JavaScript/JSX are not built-in — leave blank for plain verbatim.
    lang_map = {
        "Python": "Python",
        "JavaScript": "{}", "JSX": "{}",
        "JSON": "{}",
        "CSS": "CSS", "HTML": "HTML", "YAML": "{}",
        "TOML": "{}", "Markdown": "{}", "text": "{}",
    }
    lst_lang = lang_map.get(lang, "{}")
    lang_opt = "" if lst_lang == "{}" else f"language={lst_lang},"
    return (
        f"\\begin{{lstlisting}}[{lang_opt}breaklines=true,postbreak=\\mbox{{\\textcolor{{gray}}{{$\\hookrightarrow$\\space}}}}]\n"
        f"{code}{trailer}"
        f"\\end{{lstlisting}}\n"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Assumption data
# ──────────────────────────────────────────────────────────────────────────────

ASSUMPTIONS: list[tuple[str, list[str]]] = [
    ("Network and connectivity", [
        "The user's device has at least intermittent connectivity at first install so the service worker can precache the shell and bundled facilities. After install the app is fully usable offline.",
        "When online, OpenStreetMap Overpass and Google Places are reachable; when not, the four-tier fallback (live backend → localStorage cache → bundled JSON → hardcoded mock) ensures contacts are always returned.",
        "Render's free-tier backend spins down after 15 min of inactivity; the first request takes up to 55 s. The frontend fires a warm-up ping and shows a status banner explaining this.",
    ]),
    ("Device and browser", [
        "Modern evergreen browsers (Chrome, Edge, Firefox, Safari ≥ 14). Service Workers, Geolocation API, and Web Speech API are required for full functionality.",
        "Battery Status API is supported on Chromium-based browsers but not iOS Safari or desktop Firefox. The battery row in the dispatch screen is hidden when the API is unavailable.",
        "Accelerometer access (crash detection) requires the DeviceMotion API. iOS Safari requires an explicit permission prompt; the app degrades gracefully when denied.",
    ]),
    ("Geolocation", [
        "GPS accuracy is within 50 m in open sky, 200 m in urban canyons. The app commits a coarse fix in under 2 s and refines with watchPosition.",
        "iCloud Private Relay and similar proxies can return IP-geolocated positions hundreds of kilometres from the device. A three-layer guard (org-name check, >500 km haversine drift, Apple datacentre bbox) rejects these and re-prompts for GPS.",
        "Locations are cached at ~110 m grid resolution (3 decimal places) — coarse enough for high cache hit-rate, fine enough for emergency-contact relevance.",
    ]),
    ("Geography and data coverage", [
        "OSM data quality is best in India, Europe, and dense urban areas. In sparse rural regions the Overpass radius expands 5 km → 10 km → 20 km and falls back on bundled facilities (249 across 196 countries).",
        "Country emergency numbers are pre-bundled for all 196 countries and always render without a network call.",
        "ISO-3166 country code is resolved from Nominatim reverse-geocode; if Nominatim fails the app falls back to coarse bounding-box matching against the bundled country dataset.",
    ]),
    ("User behaviour and consent", [
        "Users grant geolocation permission on first launch; otherwise the app shows a Set-Location-Manually affordance.",
        "Medical ID data stored in localStorage is included in outgoing SOS payloads only after the user sets it up. It is never uploaded to RoadSOS servers.",
        "On auto-detected crash (velocity collapse ≥ 25 km/h → ≤ 5 km/h in 2 s confirmed by ≥ 3.5 G accelerometer spike), a 10 s cancellation window lets the user abort false positives.",
    ]),
    ("Communications channels", [
        "Country code from Nominatim determines the primary dispatch channel: WhatsApp-dominant countries (India, Brazil, Indonesia, Nigeria, etc.) use wa.me links; elsewhere native SMS deep-links are used.",
        "If the WhatsApp app is not installed, the wa.me link opens WhatsApp Web. The handler deferred-falls-back to SMS after 1.2 s if the WA window failed to open.",
        "The window.open call for WhatsApp fires synchronously inside the click handler — any await before it strips the user-gesture flag and causes browsers to silently block the popup.",
    ]),
    ("AI triage", [
        "Google Gemini 2.0 Flash is used for situational triage via direct REST (no SDK). Free-tier limits (60 RPM / 1500 RPD) are sufficient for a demo.",
        "If Gemini is unreachable or rate-limited the app falls back to deterministic rule-based prioritisation using the same two yes/no questions.",
    ]),
    ("Hosting", [
        "Frontend is on Vercel (auto-deploy from main). Backend is on Render (auto-deploy from main). Both are free tiers; production would migrate the backend to a paid host to eliminate cold starts.",
        "The frontend can be served from any static host; the backend is a vanilla FastAPI app deployable on any Python 3.11+ host with uvicorn.",
    ]),
    ("Security and privacy", [
        "Medical ID, language preference, and cached searches live in localStorage only. The backend is stateless and never persists user data.",
        "Rate limits (/search 30 rpm/IP, /triage 20 rpm/IP) are enforced by token-bucket middleware aware of Render's X-Forwarded-For header.",
        "Google Places API keys are server-side only; they are rotated per request; if a key returns 403 the rotation picks the next key. The frontend never sees them.",
    ]),
]


# ──────────────────────────────────────────────────────────────────────────────
# Build the .tex source
# ──────────────────────────────────────────────────────────────────────────────

def build_tex() -> str:
    lines: list[str] = []
    w = lines.append

    # ── Preamble ──────────────────────────────────────────────────────────
    w(r"""\documentclass[11pt, a4paper]{article}

% ─── Packages ─────────────────────────────────────────────────────────
% Compiled with LuaLaTeX for native UTF-8 / Unicode support
\usepackage{fontspec}
\setmainfont{Latin Modern Roman}
\setmonofont[Scale=0.85]{Latin Modern Mono}
\usepackage[margin=1in]{geometry}
\usepackage{hyperref}
\usepackage{xcolor}
\usepackage{listings}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{array}
\usepackage{tabularx}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage{microtype}
\usepackage{graphicx}
\usepackage{textcomp}

% ─── Colours ──────────────────────────────────────────────────────────
\definecolor{rsnavy}{HTML}{0B1424}
\definecolor{rsblue}{HTML}{1D4ED8}
\definecolor{rsred}{HTML}{DC2626}
\definecolor{rsteal}{HTML}{0F766E}
\definecolor{rsgrey}{HTML}{475569}
\definecolor{rscode}{HTML}{F1F5F9}
\definecolor{rslightbg}{HTML}{F8FAFC}

% ─── Hyperlinks ───────────────────────────────────────────────────────
\hypersetup{
  colorlinks=true,
  linkcolor=rsblue,
  urlcolor=rsblue,
  citecolor=rsblue,
  pdftitle={RoadSOS --- Hackathon Submission},
  pdfauthor={RoadSOS Engineering},
  pdfsubject={National Road Safety Hackathon 2026 --- CoERS x IIT Madras}
}

% ─── Listings ─────────────────────────────────────────────────────────
\lstdefinestyle{rscode}{
  backgroundcolor=\color{rscode},
  basicstyle=\ttfamily\fontsize{7.5}{9}\selectfont,
  breakatwhitespace=false,
  breaklines=true,
  captionpos=b,
  keepspaces=true,
  numbers=left,
  numbersep=6pt,
  numberstyle=\tiny\color{rsgrey},
  showspaces=false,
  showstringspaces=false,
  showtabs=false,
  tabsize=2,
  frame=single,
  framesep=4pt,
  rulecolor=\color{rsgrey!30},
  xleftmargin=14pt,
  commentstyle=\color{rsteal},
  keywordstyle=\color{rsblue}\bfseries,
  stringstyle=\color{rsred},
}
\lstset{style=rscode}

% ─── Headings ─────────────────────────────────────────────────────────
\titleformat{\section}{\Large\bfseries\color{rsnavy}}{\thesection}{0.6em}{}
\titleformat{\subsection}{\large\bfseries\color{rsblue}}{\thesubsection}{0.6em}{}
\titleformat{\subsubsection}{\normalsize\bfseries\color{rsnavy}}{\thesubsubsection}{0.6em}{}

% ─── Header / Footer ──────────────────────────────────────────────────
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{rsgrey} RoadSOS --- Hackathon Submission}
\fancyhead[R]{\small\color{rsgrey} \nouppercase{\leftmark}}
\fancyfoot[C]{\small\thepage}
\renewcommand{\headrulewidth}{0.4pt}

% ─── Custom commands ──────────────────────────────────────────────────
\newcommand{\file}[1]{\texttt{\small\color{rsblue}#1}}
\newcommand{\code}[1]{\texttt{\small#1}}
\newcommand{\kw}[1]{\textbf{\color{rsblue}#1}}

% ──────────────────────────────────────────────────────────────────────
\begin{document}

% ─── Title ────────────────────────────────────────────────────────────
\begin{titlepage}
\centering
\vspace*{3cm}
{\fontsize{48}{56}\selectfont\bfseries\color{rsnavy} RoadSOS}\\[0.8cm]
{\Large\color{rsblue} Hackathon Submission Package}\\[1.5cm]
\hrule\vspace{0.4cm}
{\large\color{rsgrey}
  National Road Safety Hackathon 2026\\[0.3cm]
  CoERS --- Centre of Excellence in Road Safety\\[0.1cm]
  IIT Madras\\[0.4cm]
  \url{https://coers.iitm.ac.in/events/Hackathon/2026/rule_book/}
}
\vspace{0.4cm}\hrule\vspace{1.5cm}
{\normalsize\color{rsgrey}
  \textbf{Submission deadline:} 31 May 2026 \quad
  \textbf{Repository:} \url{https://github.com/Arthrevs/Roadproj}\\[0.4cm]
  \textbf{Live app:} \url{https://roadsos.vercel.app}
}
\vfill
\begin{tabular}{ll}
\toprule
\textbf{Section} & \textbf{Contents} \\
\midrule
1. Project overview    & Problem, judging-criteria map \\
2. Assumptions         & 27 explicit design constraints \\
3. Software packages   & Backend pip + frontend npm + external APIs \\
4. Architecture        & Request flow, offline strategy, crash detection \\
5. Source code         & All 146 source files, verbatim \\
\bottomrule
\end{tabular}
\end{titlepage}

\tableofcontents
\clearpage
""")

    # ── Section 1: Overview ───────────────────────────────────────────────
    w(r"""
%% ============================================================
\section{Project overview}
%% ============================================================

\textbf{RoadSOS} --- emergency response and prioritised contact discovery for road accidents.

India records 1.5\,lakh road-accident deaths per year. The first 60 minutes after a severe
injury (the \emph{golden hour}) determines survival. At a real crash scene a bystander
currently needs 2--3 minutes just to find the right phone number via Google Maps.
RoadSOS reduces that to under 10 seconds and works fully offline.

\subsection{Judging-criteria map}

\begin{tabularx}{\textwidth}{lX}
\toprule
\textbf{Criterion (from rulebook)} & \textbf{How RoadSOS satisfies it} \\
\midrule
Number of emergency contacts found &
  OSM Overpass (9 categories, parallel) + Google Places (parallel, not sequential).
  Auto-expanding radius 5\,km $\to$ 10\,km $\to$ 20\,km. \\
Reliability &
  Every external call wrapped in \code{\_safe\_*} helpers. 3-mirror Overpass with
  exponential back-off. API always returns HTTP 200 with a valid shape. \\
Offline functionality &
  Four-tier fallback: live backend $\to$ 24\,h localStorage cache $\to$ bundled JSON
  (249 facilities, 196 countries) $\to$ hardcoded mock. Country emergency numbers
  always offline. \\
International coverage &
  196 countries pre-loaded. ISO-3166 code from Nominatim. Emergency numbers switch
  automatically at borders. \\
Six mandatory service categories &
  \code{hospital} · \code{police} · \code{ambulance} · \code{towing} · \code{tyre} ·
  \code{showroom} --- all mapped to OSM tags and Google keyword queries. \\
\bottomrule
\end{tabularx}
""")

    # ── Section 2: Assumptions ────────────────────────────────────────────
    w(r"""
%% ============================================================
\section{Assumptions}
%% ============================================================

\textit{The following assumptions underpin the design.  The code degrades gracefully
whenever any single assumption is violated at runtime.}
""")
    for heading, bullets in ASSUMPTIONS:
        w(f"\\subsection{{{esc(heading)}}}")
        w("\\begin{itemize}")
        for b in bullets:
            w(f"  \\item {esc(b)}")
        w("\\end{itemize}")
        w("")

    # ── Section 3: Software packages ─────────────────────────────────────
    w(r"""
%% ============================================================
\section{Software packages}
%% ============================================================

\subsection{Backend --- Python runtime (\file{backend/requirements.txt})}
""")
    backend_reqs = (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8")
    w(verbatim_block(backend_reqs, "text"))

    dev_path = ROOT / "backend" / "requirements-dev.txt"
    if dev_path.exists():
        w(r"\subsection{Backend --- Python development tools (\file{backend/requirements-dev.txt})}")
        w(verbatim_block(dev_path.read_text(encoding="utf-8"), "text"))

    w(r"\subsection{Frontend --- npm runtime dependencies}")
    pkg = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
    runtime = pkg.get("dependencies", {})
    dev = pkg.get("devDependencies", {})

    def pkg_table(deps: dict[str, str]) -> str:
        rows = "\n".join(
            f"  \\code{{{esc(n)}}} & {esc(v)} \\\\"
            for n, v in sorted(deps.items())
        )
        return (
            "\\begin{tabular}{ll}\n"
            "\\toprule\n"
            "\\textbf{Package} & \\textbf{Version} \\\\\n"
            "\\midrule\n"
            f"{rows}\n"
            "\\bottomrule\n"
            "\\end{tabular}\n"
        )

    w(pkg_table(runtime))
    w(r"\subsection{Frontend --- npm development dependencies}")
    w(pkg_table(dev))

    w(r"""
\subsection{External services (consumed via REST --- no SDK)}

\begin{tabularx}{\textwidth}{lX}
\toprule
\textbf{Service / API} & \textbf{Role in RoadSOS} \\
\midrule
OpenStreetMap Overpass API & Public OSM data query. Three mirrors with exponential-backoff retry. \\
OpenStreetMap Nominatim & Reverse geocoding (lat/lon $\to$ country code, landmark). \\
Google Places API (Nearby Search + Place Details) & Optional parallel fallback for sparse OSM regions. \\
Google Gemini 2.0 Flash & AI triage. Free tier: 60\,RPM / 1\,500\,RPD. \\
CartoDB Dark Matter tiles & Map tile provider (no API key required). \\
Web platform APIs & Geolocation, DeviceMotion, Battery Status, Web Speech, Service Worker. \\
\bottomrule
\end{tabularx}
""")

    # ── Section 4: Architecture ───────────────────────────────────────────
    w(r"""
%% ============================================================
\section{Architecture summary}
%% ============================================================

\textit{The full 35-page technical reference is at \file{docs/TECHNICAL.pdf} in the repository.
The summary below captures the request flow and the four-tier offline strategy.}

\subsection{Request flow --- \code{GET /search}}

\begin{enumerate}
  \item Frontend issues \code{GET /search?lat=\ldots\&lon=\ldots\&radius=5000}.
  \item Phase 1: parallel fan-out --- Nominatim reverse geocode + Overpass query
        (9 OSM categories, 3 mirrors, 12\,s timeout each).
  \item Phase 2: parallel Google Places Nearby Search if a key is configured
        (does \textbf{not} wait for OSM; \code{rankby=distance} for nearest-first).
  \item Phase 3: merge + proximity dedupe (50\,m radius), then phone enrichment
        via up to 3 Place Details calls within a 5\,s budget.
  \item Response: JSON with categorised contacts, country emergency numbers,
        landmark, ISO country code.
  \item Frontend: render on Leaflet map (CartoDB Dark Matter tiles), populate
        Quick-Contacts dock, persist to 24\,h localStorage cache.
\end{enumerate}

\subsection{Four-tier offline strategy}

\begin{enumerate}
  \item \textbf{Tier 1} --- Live backend \code{/search} call (online path).
  \item \textbf{Tier 2} --- Service Worker + localStorage cache, 24\,h TTL,
        keyed at $\sim$1.1\,km grid.
  \item \textbf{Tier 3} --- Bundled JSON shipped with the PWA:
        249 facilities across 196 countries.
  \item \textbf{Tier 4} --- Hardcoded mock so the UI never shows an empty state.
\end{enumerate}

\subsection{Crash detection}

\begin{itemize}
  \item \textbf{Signal 1} --- GPS velocity collapse: $\geq$25\,km/h $\to$
        $\leq$5\,km/h within 2\,s.
  \item \textbf{Signal 2} --- Accelerometer spike: peak magnitude $\geq$3.5\,G.
  \item \textbf{Confirmation}: both signals must occur within a 4\,s alignment window.
  \item \textbf{Cooldown}: 12\,s after confirmed event.
  \item \textbf{User override}: 10\,s PIN-cancel window before auto-dispatch.
\end{itemize}

\subsection{SOS dispatch}

\begin{itemize}
  \item WhatsApp-dominant countries (India, Brazil, Indonesia, Nigeria, \ldots):
        \code{wa.me} deep-link opened \textbf{synchronously} in the user-gesture frame.
  \item SMS-dominant countries: native \code{sms:} deep-link.
  \item Fallback: if the WA popup is closed within 1.2\,s the handler fires an
        SMS fallback URL via \code{window.location.href}.
  \item After the synchronous dispatch: camera + torch + scene-photo capture,
        live tracking session creation, and DispatchScreen overlay all run
        asynchronously without blocking the open tab.
\end{itemize}
""")

    # ── Section 5: Source code ────────────────────────────────────────────
    w(r"""
%% ============================================================
\section{Entire source code}
%% ============================================================

\textit{Every file is rendered verbatim and grouped by directory.
Paths are relative to the repository root.
The full Git history is at \url{https://github.com/Arthrevs/Roadproj}.}
""")

    files_ok = 0
    files_missing: list[str] = []

    for group_title, files in CODE_GROUPS:
        w(f"\\subsection{{{esc(group_title)}}}")
        for rel in files:
            path = ROOT / rel
            if not path.exists():
                files_missing.append(rel)
                w(f"\\textit{{\\color{{rsred}} {esc(rel)} --- not present in this revision.}}\n")
                continue
            try:
                content = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                content = path.read_text(encoding="utf-8", errors="replace")
            lang = LANG_BY_SUFFIX.get(path.suffix.lower(), "text")
            w(f"\\subsubsection{{\\file{{{esc(rel)}}}  [{esc(lang)}, {len(content):,} chars]}}")
            w(verbatim_block(content, lang))
            files_ok += 1

    w("\\clearpage")
    w("\\subsection{Source index}")
    w(f"Files included verbatim: \\textbf{{{files_ok}}}.")
    if files_missing:
        w(f"Files declared but missing on disk: {len(files_missing)}.")
        w("\\begin{itemize}")
        for f in files_missing:
            w(f"  \\item \\file{{{esc(f)}}}")
        w("\\end{itemize}")

    # ── End ──────────────────────────────────────────────────────────────
    w(r"""
\vspace{1cm}
\hrule
\vspace{0.4cm}
\small\noindent
\textbf{Document version.} Generated from \code{main}.
Re-run \code{python scripts/build\_submission\_tex.py} after any code change to regenerate.

\end{document}
""")

    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> int:
    tex = build_tex()
    OUT_TEX.parent.mkdir(exist_ok=True)
    OUT_TEX.write_text(tex, encoding="utf-8")
    print(f"  wrote {OUT_TEX}  ({len(tex):,} chars)")

    # Compile twice so TOC page numbers settle
    log_file = OUT_TEX.with_suffix(".log")
    for pass_n in (1, 2):
        result = subprocess.run(
            [
                "lualatex",
                "-interaction=nonstopmode",
                "-output-directory", str(OUT_TEX.parent),
                str(OUT_TEX),
            ],
            capture_output=True,
            timeout=180,
        )
        if result.returncode != 0:
            # Decode log bytes safely
            raw = result.stdout or b""
            log_text = raw.decode("utf-8", errors="replace")
            log_lines = log_text.splitlines()[-40:]
            print(f"\n  lualatex pass {pass_n} FAILED (exit {result.returncode}):")
            for ln in log_lines:
                print("   ", ln)
            # Also show the .log tail if it exists
            if log_file.exists():
                tail = log_file.read_text(encoding="utf-8", errors="replace").splitlines()[-20:]
                print("  --- .log tail ---")
                for ln in tail:
                    print("   ", ln)
            return 1
        print(f"  lualatex pass {pass_n} OK")

    size_kb = OUT_PDF.stat().st_size / 1024
    print(f"\nOK  {OUT_PDF}  ({size_kb:,.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
