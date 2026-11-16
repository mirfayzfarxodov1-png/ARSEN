# ARSEN — ARGON V1

ARSEN is a multilingual AI workspace with a motion-led interface, browser voice tools and a server-side AI gateway.

## Requirements

- Node.js 20+
- An OpenAI-compatible chat-completions provider for AI chat

## Run locally

```bat
copy .env.example .env
```

The server now uses Node.js built-ins only, so no `npm install` is required to start it. (Running `npm install` is harmless but unnecessary.)

Set `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` in `.env`. Keep credentials on the server. Then start it:

```bat
npm start
```

Open http://localhost:3000.

## Included in this first foundation

- Animated, responsive dark interface with a light appearance toggle.
- UI translations for English, Uzbek, Russian, Spanish, French and German.
- ARGON V1 chat orchestration through a server-side OpenAI-compatible API.
- Browser speech synthesis and speech recognition where supported by the browser/device.
- Expanded command center dashboard with live workspace stats and recent activity.
- Local project manager, task board, and searchable knowledge vault with export/import backups.
- Workspace settings, provider health checks, and a one-click local data reset.
- Installable PWA shell with offline access to the app interface (AI chat still requires a server connection).
- Agent, Game Lab and Integrations workspaces with honest connection states.
- Basic security headers, request size limits, bounded chat history and provider secrets kept server-side.

## Important capability boundaries

ARGON V1 is an orchestration layer using a configured model provider; it is not a newly pretrained foundation model. The first release does not yet control the operating system, play Roblox/Minecraft, place social posts, or make phone calls. Those features require separate, permissioned integrations, local bridges, testing and user confirmation. The UI labels these modules as planned or not connected rather than pretending they work.

## Local workspace data

Projects, tasks and notes are stored in the browser's local storage on the current device. They are not synced to a server. Use Settings → Export workspace to create a JSON backup before clearing browser data or moving to another device.

## Configuration

See `.env.example`. Do not commit `.env` or publish API keys. The server exposes:

- `GET /api/health` — readiness and configured-provider status.
- `POST /api/chat` — validated chat messages sent to the configured model provider.

## Validation

`npm run check` checks JavaScript syntax. Use `npm start` and verify the health endpoint and chat with a valid provider configuration before deployment.

## Roadmap

1. Add automated tests and stronger deployment/rate-limit protections.
2. Add a permissioned desktop companion with visible approvals and an emergency stop.
3. Build a tested game-capture/input bridge for supported games.
4. Add official social platform integrations with preview and confirmation.
5. Add phone/communications integrations only through supported providers and explicit approval.
