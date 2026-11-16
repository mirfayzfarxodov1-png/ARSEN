# ARSEN — ARGON V2 LOCAL

ARSEN is a local-first assistant. It never connects to OpenAI, Claude, Groq or another hosted AI provider. Its built-in multilingual knowledge core works without an API key. If Ollama is installed on the same computer and the selected model is available, ARSEN uses that on-device model for broader open-ended answers.

## Requirements

- Node.js 20+
- Windows, macOS or Linux
- Optional: Ollama and a locally downloaded model

## Run ARSEN

```bat
cd /d "C:\\Users\\LENOVA MIRFAYZ\\Desktop\\ARSEN"
git pull origin main
npm run check
npm start
```

Open http://localhost:3000. No `npm install`, cloud account, API key or `.env` file is required for the built-in core.

## Optional local language model (Ollama)

1. Install Ollama from its official website: https://ollama.com/download
2. Open CMD and download a small model:

```bat
ollama pull qwen2.5:0.5b
```

3. Keep Ollama running, then restart ARSEN with `npm start`.
4. ARSEN checks `http://127.0.0.1:11434` and uses `qwen2.5:0.5b` when available. No API key is used. If Ollama or the model is unavailable, the built-in knowledge core still answers supported topics.

To choose another model, edit `.env` (copy `.env.example` first) and set `LOCAL_MODEL_NAME` to the exact installed model tag. `LOCAL_MODEL_URL` defaults to the local Ollama address.

**Performance note:** Small local models can still be slow on older computers and may give weaker answers, especially in Uzbek. Start with the 0.5B model; do not download a large model on a low-memory computer. Model quality and speed depend on RAM, CPU and available disk space.

## Included

- ARGON V2 local-first chat orchestration.
- Built-in knowledge core with Uzbek, English and Russian explanations across programming, Roblox Studio, Windows, hardware, networking, AI, mathematics and study skills.
- Basic arithmetic and local greetings without a language model.
- Optional on-device Ollama model for broader generation.
- Browser text-to-speech for selected language, with opt-in automatic reading of ARSEN replies.
- Daily briefing from locally saved tasks, projects, notes and activity; click to hear the report.
- Local Chrome extension at `chrome-extension/`.
- Existing projects, tasks, knowledge vault and workspace tools.

## Honest capability boundaries

A local knowledge base and a small local model do not know everything and can make mistakes. Add trusted documents and topic-specific knowledge to improve coverage. The daily briefing summarizes workspace data saved in this browser; it is not a full device-wide activity recorder. Automatic reply speech is off until enabled with the VOICE toggle. ARSEN does not silently control the whole computer, submit forms, publish content or send messages. Those actions require separate integrations, visible permission and confirmation. The Chrome extension only sends prompts to the local ARSEN server and inserts a reviewed answer into a focused text field when you click its insert button.

## Chrome extension

The extension supports user-triggered browser navigation and web search. It recognizes common site aliases (such as Instagram, YouTube, Roblox, GitHub, Discord and ChatGPT), explicit HTTPS/HTTP URLs and domain names, and natural-language site names (which are searched as official-site queries rather than guessed). Type `open instagram`, `Instagramni och`, `Instagramga kir`, `Instagramda @username profilini och`, `Instagramni och va @username ga patpiska tash`, `open example.com`, or `qidir Roblox Studio`, then click **Ask ARSEN**. Uzbek and English site-opening/search commands are parsed by a separate tested module. Profile requests open the exact Instagram profile URL. For account-changing actions such as following, ARSEN does not click the button or change the account automatically; the user reviews the profile and confirms directly on Instagram. If a follow request has no username, ARSEN asks for the target instead of guessing. This is still browser navigation, not full computer control.

1. Start ARSEN with `npm start`.
2. Open `chrome://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the repository's `chrome-extension` folder (not the root ARSEN folder).
4. Open the ARSEN extension. It talks only to `http://localhost:3000`.

## Local endpoints

- `GET /api/health` — reports built-in core and local model status.
- `POST /api/chat` — uses the local model if installed, otherwise the built-in knowledge engine.

## Security

No external AI provider is configured. Keep the local server bound to localhost. Do not expose it publicly without authentication and additional protections.
