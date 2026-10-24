# AGENTS.md — CONBYBITE 2.0

Personal AI assistant "CONBYBITE 2.0", developed by SLOVACK. Brand line: "HELLO FRIEND — BY SLOVACK". UI copy is Portuguese (pt-BR).

## Architecture

- **Frontend**: single screen at `src/routes/index.tsx` (splash → chat). State (messages, settings) lives in `localStorage` on the device only (`cb.chat`, `cb.settings`).
- **Server routes** (TanStack Start server handlers, deployed as Netlify Functions):
  - `src/routes/api.chat.ts` — POST `{messages, search: auto|on|off}` → `{reply, sources, searched, query, model}`. Validates with zod, rate-limits, trims history to 12 turns.
  - `src/routes/api.health.ts` — GET, reports whether `GROQ_API_KEY` is set (never its value).
- **Server logic** in `src/server/`:
  - `groq.ts` — raw fetch to Groq's OpenAI-compatible API, model fallback list, sanitized errors (never forward upstream bodies).
  - `search.ts` — real web search: Tavily (if `TAVILY_API_KEY`), DuckDuckGo HTML, Wikipedia pt/en; deduped, max 8.
  - `assistant.ts` — system prompt (identity: created by SLOVACK), auto search decision via fast model + keyword regex, injects numbered sources so the model cites `[n]`.
  - `rate-limit.ts` — in-memory per-IP limit (best effort, per instance).
- **Voice**: `src/lib/voice.ts` — Web Speech API. Male voice chosen by name heuristics; pitch lowered when no male voice exists. Utterances are split by sentence (Android cuts long ones).
- **Components**: `src/components/cb/` — `splash`, `ambient` (bubbles/clouds, deterministic for SSR), `avatar` (sphere/robot with idle/listening/thinking/speaking states), `rich-text` (safe mini-markdown, no innerHTML).
- **Termux client**: `public/termux/conbybite.mjs` + `instalar.sh` (served statically so users can `curl` them). It calls `/api/chat`; it holds no keys.

## Conventions / decisions

- Groq is used directly (user requirement) — not the Netlify AI Gateway. Keys only via env vars.
- No streaming, by design (stability, simple Termux client, low consumption).
- Hands-free loop uses refs (`handsFreeRef`, `busyRef`) to avoid stale closures; recognizer is recreated each turn (more reliable on Android).
- Theme colors are in `src/styles.css` (`.dark` overrides + `cb-*` classes). The `<html>` has class `dark`. Animations use transform/opacity only and honor `prefers-reduced-motion`.
- Fonts: Michroma (brand), Manrope (body).
