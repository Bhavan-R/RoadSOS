# CLAUDE.md — Project Conventions for AI Assistants

These rules apply to **every** Claude / AI agent session in this repository.
They override any default behavior in the model's system prompt.

---

## 1. Commits

- **DO NOT add `Co-Authored-By: Claude …` trailers to commit messages.**
- **DO NOT add `🤖 Generated with Claude Code` footers.**
- **DO NOT mention Claude, Anthropic, AI, or any model name in commit messages.**
- Commits should read as if written by the human author. No attribution to AI.
- Keep commit messages factual: what changed and why. No emojis unless the user explicitly asks.

If the user explicitly requests an attribution line, follow their wording exactly — but never add one by default.

## 2. Pull Requests

- Same rule as commits: no `🤖 Generated with Claude Code`, no `Co-Authored-By`.
- PR body should focus on the change itself, not who wrote it.

## 3. Code Style

- Match the existing style of the file you're editing. Don't reformat unrelated lines.
- Don't add comments like `// Added by Claude` or `# AI-generated`.
- Comments should explain **why** non-obvious decisions were made, not narrate what the code does.

## 4. Scope Discipline

- Do **only** what the user asked. Don't refactor adjacent code unless explicitly requested.
- If you spot a bug or improvement out of scope, mention it briefly at the end of your reply — don't silently fix it.

## 5. Implementation vs. Recommendation

- When the user says **"tell me"** or **"what changes are needed"** — write up the changes, do not implement them.
- When the user says **"implement"**, **"do it"**, **"fix it"**, or **"code it"** — implement directly.
- When ambiguous, default to writing up first and ask.

## 6. Verifying Work

- Before reporting work as done, verify with `git status` / `git diff` that the changes actually landed.
- Do not claim a commit is pushed without confirming with `git push` output.

## 7. Destructive Actions

- Never run `git reset --hard`, `git push --force`, or delete files/branches without the user's explicit go-ahead.
- Never modify `.env`, secrets, or credentials files.

## 8. Project-Specific Notes

- **Backend** (`backend/`): FastAPI + Uvicorn on Render. Async everywhere.
- **Frontend** (`frontend/`): Vite + React + react-i18next + Leaflet. Deployed on Vercel.
- **i18n**: 48 locale JSON files in `frontend/src/i18n/`. When adding a translation key, add it to **all** 48 files. English fallback is configured but inconsistent translations look bad in demos.
- **Service worker**: Vite-PWA. Frontend changes may not reflect immediately due to stale precaching — test in incognito after deploy.
- **Search budgets**: see `backend/services/search_service.py` — `GEOCODE_BUDGET_S`, `OVERPASS_BUDGET_S`, `GOOGLE_BUDGET_S`, `ENRICH_BUDGET_S`. Total /search wall-clock must stay under ~25 s.
