# ARSEN development instructions

- Keep all work on the existing `main` branch; do not create branches unless the owner explicitly changes this preference.
- Keep provider secrets server-side. Never commit `.env`, tokens, cookies, or credentials.
- Never present a planned integration as connected or claim an external action succeeded without a confirmed tool result.
- Require explicit confirmation before sending messages, publishing content, making calls, or controlling a user's device.
- Keep UI language, assistant response language and browser speech language aligned with the selected locale.
- Prefer accessible semantic controls, keyboard support, responsive layouts and reduced-motion support.
- Run `npm run check` after JavaScript changes. Add tests when behavior expands.
- ARGON V1 is an orchestration layer, not a pretrained model. Document provider and integration requirements honestly.
